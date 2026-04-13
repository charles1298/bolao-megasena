const { prisma } = require('./prismaClient');
const logger = require('../utils/logger');

/**
 * Distribuição de prêmios conforme as regras:
 * - 6 acertos: 65% do total
 * - Pé quente (5 acertos): 10% dividido entre todos com 5 acertos
 * - Pé frio (0 acertos no último draw): 5% dividido entre todos com 0 acertos
 * - Casa: 20%
 */
const PRIZE_RULES = {
  SIX_HITS: 0.65,
  PE_QUENTE: 0.10,
  PE_FRIO: 0.05,
  HOUSE: 0.20,
};

/**
 * Processa a distribuição de prêmios ao final do jogo.
 * Deve ser chamado apenas uma vez quando houver ganhador.
 *
 * @param {string} gameId
 * @returns {object} Resumo da distribuição
 */
async function distributePrizes(gameId) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      tickets: {
        where: { status: { in: ['winner', 'active'] } },
        include: { user: true },
      },
    },
  });

  if (!game) throw new Error('Jogo não encontrado.');
  if (game.prizeProcessed) throw new Error('Prêmios já foram distribuídos para este jogo.');
  if (game.status !== 'finished') throw new Error('Jogo ainda não finalizado.');

  const totalPot = await calculateTotalPot(gameId);
  if (totalPot <= 0) throw new Error('Não há valor arrecadado para distribuir.');

  const winners = game.tickets.filter((t) => t.status === 'winner');
  const peQuenteTickets = game.tickets.filter((t) => t.isPeQuente);
  const peFrioTickets = game.tickets.filter((t) => t.isPeFrio);

  if (winners.length === 0) throw new Error('Nenhum ganhador encontrado.');

  const prizePool = Number(totalPot);

  // Calcula valores
  const sixHitsPrize = prizePool * PRIZE_RULES.SIX_HITS;
  const peQuentePrize = prizePool * PRIZE_RULES.PE_QUENTE;
  const peFrioPrize = prizePool * PRIZE_RULES.PE_FRIO;
  const housePrize = prizePool * PRIZE_RULES.HOUSE;

  // Divide prêmio igualmente entre ganhadores
  const perWinner = winners.length > 0 ? sixHitsPrize / winners.length : 0;
  const perPeQuente = peQuenteTickets.length > 0 ? peQuentePrize / peQuenteTickets.length : 0;
  const perPeFrio = peFrioTickets.length > 0 ? peFrioPrize / peFrioTickets.length : 0;

  const updates = [];

  for (const ticket of winners) {
    updates.push(
      prisma.ticket.update({
        where: { id: ticket.id },
        data: { prizeAmount: perWinner.toFixed(2) },
      })
    );
  }

  for (const ticket of peQuenteTickets) {
    const current = Number(ticket.prizeAmount || 0);
    updates.push(
      prisma.ticket.update({
        where: { id: ticket.id },
        data: { prizeAmount: (current + perPeQuente).toFixed(2) },
      })
    );
  }

  for (const ticket of peFrioTickets) {
    const current = Number(ticket.prizeAmount || 0);
    updates.push(
      prisma.ticket.update({
        where: { id: ticket.id },
        data: { prizeAmount: (current + perPeFrio).toFixed(2) },
      })
    );
  }

  // Marca prêmios como distribuídos e atualiza pot do jogo
  updates.push(
    prisma.game.update({
      where: { id: gameId },
      data: {
        totalPot: prizePool.toFixed(2),
        prizeProcessed: true,
      },
    })
  );

  await prisma.$transaction(updates);

  logger.info('Prêmios distribuídos', {
    gameId,
    totalPot: prizePool.toFixed(2),
    winners: winners.length,
    perWinner: perWinner.toFixed(2),
    peQuente: peQuenteTickets.length,
    perPeQuente: perPeQuente.toFixed(2),
    peFrio: peFrioTickets.length,
    perPeFrio: perPeFrio.toFixed(2),
    housePrize: housePrize.toFixed(2),
  });

  return {
    totalPot: prizePool.toFixed(2),
    distribution: {
      sixHits: {
        percentage: `${(PRIZE_RULES.SIX_HITS * 100).toFixed(0)}%`,
        totalAmount: sixHitsPrize.toFixed(2),
        winners: winners.length,
        perWinner: perWinner.toFixed(2),
      },
      peQuente: {
        percentage: `${(PRIZE_RULES.PE_QUENTE * 100).toFixed(0)}%`,
        totalAmount: peQuentePrize.toFixed(2),
        count: peQuenteTickets.length,
        perTicket: perPeQuente.toFixed(2),
      },
      peFrio: {
        percentage: `${(PRIZE_RULES.PE_FRIO * 100).toFixed(0)}%`,
        totalAmount: peFrioPrize.toFixed(2),
        count: peFrioTickets.length,
        perTicket: perPeFrio.toFixed(2),
      },
      house: {
        percentage: `${(PRIZE_RULES.HOUSE * 100).toFixed(0)}%`,
        amount: housePrize.toFixed(2),
      },
    },
  };
}

async function calculateTotalPot(gameId) {
  const result = await prisma.payment.aggregate({
    where: {
      ticket: { gameId },
      status: 'approved',
    },
    _sum: { amount: true },
  });
  return Number(result._sum.amount || 0);
}

module.exports = { distributePrizes, PRIZE_RULES };
