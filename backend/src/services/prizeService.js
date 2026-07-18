const { prisma } = require('./prismaClient');
const logger = require('../utils/logger');

/**
 * Divisão do valor arrecadado quando sai o ganhador:
 * - Ganhador (acertou os 8): 79% do total
 * - Casa (organizadores): 20% do total (10% + 10%)
 * - Taxa do gateway (Mercado Pago): 1% do total
 *
 * O pagamento ao ganhador é feito manualmente por PIX (auditado nos campos
 * prize_paid_* da cartela). Aqui apenas calculamos e registramos os valores.
 */
const PRIZE_RULES = {
  WINNER: 0.79,
  HOUSE: 0.20,
  GATEWAY: 0.01,
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
        where: { status: 'winner' },
        include: { user: true },
      },
    },
  });

  if (!game) throw new Error('Jogo não encontrado.');
  if (game.prizeProcessed) throw new Error('Prêmios já foram distribuídos para este jogo.');
  if (game.status !== 'finished') throw new Error('Jogo ainda não finalizado.');

  const totalPot = await calculateTotalPot(gameId);
  if (totalPot <= 0) throw new Error('Não há valor arrecadado para distribuir.');

  const winners = game.tickets;
  if (winners.length === 0) throw new Error('Nenhum ganhador encontrado.');

  const prizePool = Number(totalPot);

  // Valores da divisão
  const winnerPrize  = prizePool * PRIZE_RULES.WINNER;
  const houseAmount  = prizePool * PRIZE_RULES.HOUSE;
  const gatewayAmount = prizePool * PRIZE_RULES.GATEWAY;

  // Divide o prêmio igualmente entre ganhadores (normalmente 1)
  const perWinner = winnerPrize / winners.length;

  const updates = [];

  for (const ticket of winners) {
    updates.push(
      prisma.ticket.update({
        where: { id: ticket.id },
        data: { prizeAmount: perWinner.toFixed(2) },
      })
    );
  }

  // Marca prêmios como distribuídos e fixa o pot do jogo
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
    house: houseAmount.toFixed(2),
    gateway: gatewayAmount.toFixed(2),
  });

  return {
    totalPot: prizePool.toFixed(2),
    distribution: {
      winner: {
        percentage: `${(PRIZE_RULES.WINNER * 100).toFixed(0)}%`,
        totalAmount: winnerPrize.toFixed(2),
        winners: winners.length,
        perWinner: perWinner.toFixed(2),
      },
      house: {
        percentage: `${(PRIZE_RULES.HOUSE * 100).toFixed(0)}%`,
        amount: houseAmount.toFixed(2),
        perOrganizer: (houseAmount / 2).toFixed(2),
      },
      gateway: {
        percentage: `${(PRIZE_RULES.GATEWAY * 100).toFixed(0)}%`,
        amount: gatewayAmount.toFixed(2),
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
