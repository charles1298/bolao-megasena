const { prisma } = require('./prismaClient');
const logger = require('../utils/logger');

/**
 * Retorna o jogo ativo atual.
 */
async function getActiveGame() {
  return prisma.game.findFirst({
    where: { status: 'active' },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Retorna o jogo mais recente (ativo ou não).
 */
async function getLatestGame() {
  return prisma.game.findFirst({
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Verifica se um conjunto de números é válido.
 * - Exatamente `required` números (cartela = 8; sorteio oficial da Mega = 6)
 * - Todos entre 1 e 60
 * - Sem repetições
 */
function validateNumbers(numbers, required = 8) {
  if (!Array.isArray(numbers) || numbers.length !== required) {
    return { valid: false, error: `Selecione exatamente ${required} números.` };
  }
  const nums = numbers.map(Number);
  if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > 60)) {
    return { valid: false, error: 'Números devem ser inteiros entre 1 e 60.' };
  }
  if (new Set(nums).size !== required) {
    return { valid: false, error: 'Números não podem se repetir.' };
  }
  return { valid: true, numbers: nums.sort((a, b) => a - b) };
}

/**
 * Processa um sorteio da Mega Sena para o jogo ativo.
 * Calcula acertos acumulados e verifica ganhadores.
 *
 * Regra de acumulação:
 * - Os números sorteados de cada draw se acumulam no jogo
 * - Uma cartela acumula acertos de todos os draws anteriores
 * - Quando uma cartela acertar TODOS os seus 8 números = ganhador
 *
 * @param {string} gameId
 * @param {number[]} drawnNumbers - 6 números deste sorteio (oficial da Mega)
 * @param {Date} drawDate
 * @returns {{ winners: Ticket[], peQuente: Ticket[], peFrio: Ticket[] }}
 */
async function processDraw(gameId, drawnNumbers, drawDate) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      tickets: {
        where: { status: 'active' },
        include: { user: true, payment: true },
      },
    },
  });

  if (!game) throw new Error('Jogo não encontrado.');
  if (game.status !== 'active') throw new Error('Jogo não está ativo.');

  // Atualiza números acumulados do jogo
  const previousAccumulated = game.accumulatedNumbers || [];
  const newAccumulated = [...new Set([...previousAccumulated, ...drawnNumbers])];

  const drawOrder = (game.drawCount || 0) + 1;

  // Cria o registro do sorteio
  const draw = await prisma.draw.create({
    data: {
      gameId,
      drawDate,
      numbers: drawnNumbers,
      drawOrder,
    },
  });

  const winners = [];
  const updatedTickets = [];

  for (const ticket of game.tickets) {
    // Conta quantos números da cartela estão nos acumulados NOVOS
    const hitsInAccumulated = ticket.numbers.filter((n) => newAccumulated.includes(n)).length;

    // Calcula acertos APENAS neste draw
    const hitsThisDraw = ticket.numbers.filter((n) => drawnNumbers.includes(n)).length;

    // Histórico de acertos por draw
    const hitHistory = Array.isArray(ticket.hitHistory) ? ticket.hitHistory : [];
    hitHistory.push({
      drawId: draw.id,
      drawOrder,
      drawDate: drawDate.toISOString(),
      drawnNumbers,
      hitsThisDraw,
      totalAccumulated: hitsInAccumulated,
    });

    const isWinner = hitsInAccumulated >= 8;
    updatedTickets.push({
      id: ticket.id,
      totalHits: hitsInAccumulated,
      hitHistory,
      status: isWinner ? 'winner' : 'active',
      ticket,
    });

    if (isWinner) winners.push(ticket);
  }

  // Modelo atual: prêmio único pro ganhador (acertou os 8). Sem pé quente/pé frio.
  const peQuente = [];
  const peFrio = [];

  // Atualiza todas as cartelas no banco em transação
  await prisma.$transaction(async (tx) => {
    // Atualiza game
    await tx.game.update({
      where: { id: gameId },
      data: {
        accumulatedNumbers: newAccumulated,
        drawCount: drawOrder,
        status: winners.length > 0 ? 'finished' : 'active',
      },
    });

    for (const t of updatedTickets) {
      await tx.ticket.update({
        where: { id: t.id },
        data: {
          totalHits: t.totalHits,
          hitHistory: t.hitHistory,
          status: t.status,
          isPeQuente: false,
          isPeFrio: false,
        },
      });
    }
  });

  return {
    draw,
    winners: updatedTickets.filter((t) => t.status === 'winner').map((t) => t.ticket),
    peQuente,
    peFrio,
  };
}

/**
 * Calcula o total arrecadado do jogo (cartelas pagas).
 */
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

module.exports = {
  getActiveGame,
  getLatestGame,
  validateNumbers,
  processDraw,
  calculateTotalPot,
};
