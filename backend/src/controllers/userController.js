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
 * Atualiza whatsapp do usuário.
 */
async function updateProfile(req, res) {
  try {
    const { whatsapp } = req.body;

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { whatsapp: whatsapp || null },
      select: { id: true, nickname: true, whatsapp: true },
    });

    res.json(updated);
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
    const [tickets, user] = await Promise.all([
      prisma.ticket.findMany({
        where: { userId: req.user.id },
        include: {
          payment: { select: { status: true } },
          game: { select: { name: true, status: true } },
        },
      }),
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: { balance: true },
      }),
    ]);

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
      balance: Number(user?.balance || 0).toFixed(2),
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

module.exports = { getProfile, updateProfile, getMyStats, changePassword };
