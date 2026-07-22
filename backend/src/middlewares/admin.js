const { prisma } = require('../services/prismaClient');
const logger = require('../utils/logger');

/**
 * Garante que req.user tem role = admin e que 2FA está ativo.
 * Endpoints de setup do TOTP são isentos para permitir configuração inicial.
 * Deve ser usado APÓS authenticate.
 */
async function requireAdmin(req, res, next) {
  try {
    if (!req.user || req.user.role !== 'admin') {
      logger.warn('Tentativa de acesso admin não autorizada', {
        userId: req.user?.id,
        ip: req.ip,
        path: req.path,
      });
      return res.status(403).json({ error: 'Acesso restrito a administradores.' });
    }

    // 2FA obrigatório no painel admin. Exceção: os próprios endpoints de setup/
    // confirmação do TOTP — senão seria impossível ativar o 2FA na primeira vez.
    const isTotpSetupRoute = req.path.includes('/totp');
    if (!isTotpSetupRoute) {
      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { totpEnabled: true },
      });
      if (!dbUser?.totpEnabled) {
        return res.status(403).json({
          error: 'Autenticação em dois fatores (2FA) é obrigatória para o painel administrativo.',
          code: 'TOTP_SETUP_REQUIRED',
        });
      }
    }

    next();
  } catch (err) {
    next(err);
  }
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
    // Não bloqueia a operação, mas loga como error para aparecer nos alertas
    logger.error('AUDIT LOG FALHOU — ação não registrada', {
      adminId, action,
      message: err.message,
      stack: err.stack,
    });
  }
}

module.exports = { requireAdmin, logAdminAction };
