const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../services/prismaClient');
const { decryptTotp } = require('../utils/cryptoHelper');
const { cleanCpf, isValidCpf } = require('../utils/cpfHelper');
const redisClient = require('../services/redisClient');
const logger = require('../utils/logger');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// Máximo de refresh tokens simultâneos: admin usa 2 (menos superfície), player usa 5
const MAX_REFRESH_TOKENS = { admin: 2, player: 5 };

// Tentativas de login falhas antes de bloquear a conta (por nickname)
const MAX_FAILED_LOGIN_ATTEMPTS = 10;
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 min

/**
 * Remove os refresh tokens mais antigos se o usuário ultrapassar o limite por role.
 */
async function pruneOldRefreshTokens(userId, role) {
  const max = MAX_REFRESH_TOKENS[role] ?? 5;
  const tokens = await prisma.refreshToken.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (tokens.length >= max) {
    const excess = tokens.slice(0, tokens.length - max + 1);
    await prisma.refreshToken.deleteMany({
      where: { id: { in: excess.map((t) => t.id) } },
    });
  }
}

/**
 * Verifica se uma conta está bloqueada por excesso de tentativas falhas.
 */
async function isAccountLocked(nickname) {
  const since = new Date(Date.now() - FAILED_LOGIN_WINDOW_MS);
  const failures = await prisma.loginAttempt.count({
    where: { nickname, success: false, createdAt: { gte: since } },
  });
  return failures >= MAX_FAILED_LOGIN_ATTEMPTS;
}

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, nickname: user.nickname, role: user.role },
    JWT_SECRET,
    // Access token curto: o frontend renova de forma transparente via refresh token
    // (interceptor em api.js trata TOKEN_EXPIRED). Reduz a janela de uso de um
    // token vazado, já que a blacklist de logout é fail-open se o Redis cair.
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
}

async function register(req, res) {
  try {
    const { nickname, password, whatsapp, cpf: rawCpf } = req.body;

    // CPF: limpa formatação e valida checksum oficial (mod 11)
    const cpf = cleanCpf(rawCpf);
    if (!cpf || !isValidCpf(cpf)) {
      return res.status(422).json({ error: 'CPF inválido.' });
    }

    // Verifica duplicatas (nickname, whatsapp e cpf são únicos)
    const existing = await prisma.user.findUnique({ where: { nickname } });
    if (existing) {
      return res.status(409).json({ error: 'Apelido já em uso.' });
    }

    if (whatsapp) {
      const existingWhatsapp = await prisma.user.findUnique({ where: { whatsapp } });
      if (existingWhatsapp) {
        return res.status(409).json({ error: 'Este WhatsApp já está cadastrado em outra conta.' });
      }
    }

    const existingCpf = await prisma.user.findUnique({ where: { cpf } });
    if (existingCpf) {
      return res.status(409).json({ error: 'Este CPF já está cadastrado.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    let user;
    try {
      user = await prisma.user.create({
        data: {
          nickname,
          passwordHash,
          whatsapp: whatsapp || null,
          cpf,
          role: 'player',
        },
        select: { id: true, nickname: true, role: true, createdAt: true },
      });
    } catch (createErr) {
      // Caso raro: race condition entre a checagem acima e o create
      if (createErr.code === 'P2002') {
        const target = createErr.meta?.target || [];
        if (target.includes('cpf'))      return res.status(409).json({ error: 'Este CPF já está cadastrado.' });
        if (target.includes('whatsapp')) return res.status(409).json({ error: 'Este WhatsApp já está cadastrado em outra conta.' });
        if (target.includes('nickname')) return res.status(409).json({ error: 'Apelido já em uso.' });
        return res.status(409).json({ error: 'Conta duplicada.' });
      }
      throw createErr;
    }

    logger.info('Usuário registrado', { userId: user.id, nickname: user.nickname });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Remove tokens antigos excedentes antes de criar o novo
    await pruneOldRefreshTokens(user.id, user.role);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.status(201).json({
      user: { id: user.id, nickname: user.nickname, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    logger.safeError('Erro no registro', err);
    res.status(500).json({ error: 'Erro ao criar conta.' });
  }
}

async function login(req, res) {
  try {
    const { nickname, password } = req.body;
    const ip = req.ip;

    // Verifica lockout por excesso de falhas neste nickname
    if (await isAccountLocked(nickname)) {
      return res.status(429).json({
        error: 'Conta temporariamente bloqueada por excesso de tentativas. Aguarde 15 minutos.',
        code: 'ACCOUNT_LOCKED',
      });
    }

    const user = await prisma.user.findUnique({
      where: { nickname },
      select: {
        id: true, nickname: true, passwordHash: true,
        role: true, isActive: true, totpEnabled: true, totpSecret: true,
      },
    });

    // Registra tentativa (mesmo em caso de usuário inválido — para timing safety)
    const passwordMatch = user
      ? await bcrypt.compare(password, user.passwordHash)
      : await bcrypt.compare(password, '$2b$12$invalidhashfortimingprotection00000000000000');

    if (!user || !passwordMatch || !user.isActive) {
      await prisma.loginAttempt.create({
        data: { ipAddress: ip, nickname, success: false },
      });
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    // Se 2FA ativo, exige código TOTP
    if (user.totpEnabled) {
      const { totpToken } = req.body;
      if (!totpToken) {
        return res.status(200).json({ requires2FA: true });
      }

      const { verifyToken } = require('../services/totpService');
      const plainSecret = decryptTotp(user.totpSecret);
      if (!verifyToken(totpToken, plainSecret)) {
        await prisma.loginAttempt.create({
          data: { ipAddress: ip, nickname, success: false },
        });
        return res.status(401).json({ error: 'Código 2FA inválido.' });
      }
    }

    await prisma.loginAttempt.create({
      data: { ipAddress: ip, nickname, success: true },
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Remove tokens antigos excedentes antes de criar o novo (limite por role)
    await pruneOldRefreshTokens(user.id, user.role);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    logger.info('Login realizado', { userId: user.id, ip, role: user.role });

    res.json({
      user: { id: user.id, nickname: user.nickname, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    logger.safeError('Erro no login', err);
    res.status(500).json({ error: 'Erro ao realizar login.' });
  }
}

async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token ausente.' });
    }

    let payload;
    try {
      payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ error: 'Refresh token inválido ou expirado.' });
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { select: { id: true, nickname: true, role: true, isActive: true } } },
    });

    if (!storedToken || storedToken.expiresAt < new Date() || !storedToken.user.isActive) {
      return res.status(401).json({ error: 'Refresh token inválido.' });
    }

    // Rotaciona o token
    await prisma.refreshToken.delete({ where: { token: refreshToken } });

    const newAccessToken = generateAccessToken(storedToken.user);
    const newRefreshToken = generateRefreshToken(storedToken.user);

    await prisma.refreshToken.create({
      data: {
        userId: storedToken.user.id,
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    logger.safeError('Erro no refresh', err);
    res.status(500).json({ error: 'Erro ao renovar token.' });
  }
}

async function logout(req, res) {
  try {
    // Coloca o access token atual na blacklist do Redis até ele expirar naturalmente
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ') && redisClient.isReady) {
      const token = authHeader.slice(7);
      try {
        const payload = jwt.decode(token);
        if (payload?.exp) {
          const ttl = payload.exp - Math.floor(Date.now() / 1000);
          if (ttl > 0) {
            await redisClient.set(`revoked:${token}`, '1', { EX: ttl });
          }
        }
      } catch {
        // Não crítico — token provavelmente já expirou
      }
    }

    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    res.json({ message: 'Logout realizado.' });
  } catch (err) {
    logger.safeError('Erro no logout', err);
    res.status(500).json({ error: 'Erro ao fazer logout.' });
  }
}

module.exports = { register, login, refresh, logout };
