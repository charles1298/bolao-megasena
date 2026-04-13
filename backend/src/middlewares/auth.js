const jwt = require('jsonwebtoken');
const { prisma } = require('../services/prismaClient');
const logger = require('../utils/logger');

/**
 * Verifica JWT de acesso.
 * Popula req.user = { id, nickname, role }
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de acesso ausente.' });
    }

    const token = authHeader.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expirado.', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Token inválido.' });
    }

    // Verifica se o usuário ainda existe e está ativo
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, nickname: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Usuário não encontrado ou desativado.' });
    }

    req.user = user;
    next();
  } catch (err) {
    logger.safeError('Erro no middleware de autenticação', err);
    res.status(500).json({ error: 'Erro interno de autenticação.' });
  }
}

/**
 * Middleware opcional — popula req.user se token presente, não falha se ausente.
 */
async function optionalAuthenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, nickname: true, role: true, isActive: true },
    });

    if (user && user.isActive) {
      req.user = user;
    }
  } catch {
    // Ignora erros — token inválido simplesmente não autentica
  }
  next();
}

module.exports = { authenticate, optionalAuthenticate };
