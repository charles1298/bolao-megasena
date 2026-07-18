const { prisma } = require('../services/prismaClient');
const logger = require('../utils/logger');

/**
 * GET /api/users/me
 * Perfil do usuário autenticado.
 */
async function getProfile(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        nickname: true,
        whatsapp: true,
        role: true,
        createdAt: true,
        _count: { select: { tickets: true } },
      },
    });

    res.json(user);
  } catch (err) {
    logger.safeError('Erro ao buscar perfil', err);
    res.status(500).json({ error: 'Erro ao buscar perfil.' });
  }
}

/**
 * PATCH /api/users/me
 * Atualiza whatsapp do usuário. Bloqueia duplicatas com mensagem clara.
 */
async function updateProfile(req, res) {
  try {
    const { whatsapp } = req.body;
    const newWhats = whatsapp ? String(whatsapp).replace(/\D/g, '') : null;

    // Checagem prévia: se outro usuário já tem esse WhatsApp, rejeita com mensagem amigável
    if (newWhats) {
      const conflict = await prisma.user.findFirst({
        where: { whatsapp: newWhats, NOT: { id: req.user.id } },
        select: { id: true },
      });
      if (conflict) {
        return res.status(409).json({ error: 'Este WhatsApp já está cadastrado em outra conta.' });
      }
    }

    try {
      const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: { whatsapp: newWhats },
        select: { id: true, nickname: true, whatsapp: true },
      });
      return res.json(updated);
    } catch (updateErr) {
      // Race condition: outro request criou conflito entre a checagem e o update
      if (updateErr.code === 'P2002') {
        return res.status(409).json({ error: 'Este WhatsApp já está cadastrado em outra conta.' });
      }
      throw updateErr;
    }
  } catch (err) {
    logger.safeError('Erro ao atualizar perfil', err);
    res.status(500).json({ error: 'Erro ao atualizar perfil.' });
  }
}

/**
 * GET /api/users/me/stats
 * Estatísticas do usuário: acertos, prêmios, etc.
 */
async function getMyStats(req, res) {
  try {
    const tickets = await prisma.ticket.findMany({
      where: { userId: req.user.id },
      include: {
        payment: { select: { status: true } },
        game: { select: { name: true, status: true } },
      },
    });

    const activeTickets = tickets.filter((t) => t.status === 'active');
    const winners = tickets.filter((t) => t.status === 'winner');
    const peQuente = tickets.filter((t) => t.isPeQuente);
    const peFrio = tickets.filter((t) => t.isPeFrio);

    const totalSpent = tickets
      .filter((t) => t.payment?.status === 'approved')
      .length * parseFloat(process.env.TICKET_PRICE_BRL || '30');

    const totalPrize = tickets
      .reduce((sum, t) => sum + Number(t.prizeAmount || 0), 0);

    const bestHits = tickets.reduce((max, t) => Math.max(max, t.totalHits || 0), 0);
    const totalHits = tickets.reduce((sum, t) => sum + (t.totalHits || 0), 0);

    res.json({
      totalTickets: tickets.length,
      activeTickets: activeTickets.length,
      winners: winners.length,
      peQuente: peQuente.length,
      peFrio: peFrio.length,
      totalSpent: totalSpent.toFixed(2),
      totalPrize: totalPrize.toFixed(2),
      bestHits,
      totalHits,
    });
  } catch (err) {
    logger.safeError('Erro ao buscar estatísticas', err);
    res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
  }
}

/**
 * PUT /api/users/me/password
 * Troca a senha do usuário autenticado.
 */
async function changePassword(req, res) {
  const bcrypt = require('bcrypt');
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Senha atual incorreta.' });

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    const hash = await bcrypt.hash(newPassword, rounds);

    // Invalida todas as sessões existentes (exceto a atual) após troca de senha
    await prisma.$transaction([
      prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: hash } }),
      prisma.refreshToken.deleteMany({ where: { userId: req.user.id } }),
    ]);

    logger.info('Senha alterada — sessões revogadas', { userId: req.user.id });
    res.json({ message: 'Senha alterada com sucesso. Faça login novamente nos outros dispositivos.' });
  } catch (err) {
    logger.safeError('Erro ao trocar senha', err);
    res.status(500).json({ error: 'Erro ao trocar senha.' });
  }
}

/**
 * DELETE /api/users/me
 * Exclui a conta do usuário autenticado (anonimização LGPD).
 * Mantém os registros de cartelas/pagamentos por exigência fiscal/auditoria,
 * mas remove qualquer dado pessoal (apelido, WhatsApp, senha).
 * Após esta operação o usuário não consegue mais fazer login.
 */
async function deleteMyAccount(req, res) {
  const bcrypt = require('bcrypt');
  const crypto = require('crypto');
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Confirme sua senha para excluir a conta.' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    // Admin não pode se autoexcluir — evita ficar sem admin
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Conta administrativa não pode ser excluída por aqui.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Senha incorreta.' });

    // Anonimiza: apelido vira marcador único, senha vira hash aleatório (impossível logar),
    // WhatsApp e 2FA removidos, conta desativada. Cartelas/pagamentos ficam preservados
    // referenciando o ID original (auditoria contábil).
    const anonNickname = `deleted_${user.id.slice(0, 8)}`;
    const randomPassword = crypto.randomBytes(48).toString('hex');
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    const sealedHash = await bcrypt.hash(randomPassword, rounds);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          nickname:    anonNickname,
          passwordHash: sealedHash,
          whatsapp:    null,
          totpSecret:  null,
          totpEnabled: false,
          isActive:    false,
        },
      }),
      // Revoga todas as sessões existentes
      prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    ]);

    logger.info('Conta anonimizada por solicitação do usuário (LGPD)', { userId: user.id });
    res.json({ message: 'Conta excluída com sucesso.' });
  } catch (err) {
    logger.safeError('Erro ao excluir conta', err);
    res.status(500).json({ error: 'Erro ao excluir conta.' });
  }
}

module.exports = { getProfile, updateProfile, getMyStats, changePassword, deleteMyAccount };
