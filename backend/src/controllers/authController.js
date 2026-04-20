const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../services/prismaClient');
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
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
}

async function register(req, res) {
  try {
    const { nickname, password, whatsapp } = req.body;

    // Verifica duplicata
    const existing = await prisma.user.findUnique({ where: { nickname } });
    if (existing) {
      return res.status(409).json({ error: 'Apelido já em uso.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        nickname,
        passwordHash,
        whatsapp: whatsapp || null,
        role: 'player',
      },
      select: { id: true, nickname: true, role: true, createdAt: true },
    });

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
      if (!verifyToken(totpToken, user.totpSecret)) {
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
      // Avisa admin sem 2FA configurado (não bloqueia, mas incentiva)
      ...(user.role === 'admin' && !user.totpEnabled
        ? { securityWarning: 'Ative o 2FA no painel admin para aumentar a segurança da conta.' }
        : {}),
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
