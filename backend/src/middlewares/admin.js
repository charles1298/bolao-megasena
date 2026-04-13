const { prisma } = require('../services/prismaClient');
const logger = require('../utils/logger');

/**
 * Garante que req.user tem role = admin.
 * Deve ser usado APÓS authenticate.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    logger.warn('Tentativa de acesso admin não autorizada', {
      userId: req.user?.id,
      ip: req.ip,
      path: req.path,
    });
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
}

/**
 * Registra ação do admin no banco.
 */
async function logAdminAction(adminId, action, details = {}, ipAddress = null) {
  try {
    await prisma.adminLog.create({
      data: {
        adminId,
        action,
        details,
        ipAddress,
      },
    });
  } catch (err) {
    logger.safeError('Falha ao registrar log de admin', err, { adminId, action });
  }
}

module.exports = { requireAdmin, logAdminAction };
