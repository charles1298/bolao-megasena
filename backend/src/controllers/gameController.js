const { prisma } = require('../services/prismaClient');
const { validateNumbers, getActiveGame } = require('../services/gameService');
const { createPixPayment } = require('../services/mercadoPagoService');
const megaSenaService = require('../services/megaSenaService');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const TICKET_PRICE = parseFloat(process.env.TICKET_PRICE_BRL || '30.00');

/**
 * GET /api/game/current
 * Retorna info pública do jogo ativo.
 */
async function getCurrentGame(req, res) {
  try {
    const game = await prisma.game.findFirst({
      where: { status: { in: ['active', 'pending'] } },
      orderBy: { createdAt: 'desc' },
      include: {
        draws: {
          orderBy: { drawOrder: 'asc' },
          select: { id: true, drawDate: true, numbers: true, drawOrder: true },
        },
        _count: { select: { tickets: { where: { status: 'active' } } } },
      },
    });

    if (!game) {
      return res.status(404).json({ error: 'Nenhum jogo ativo no momento.' });
    }

    // Calcula pot atual
    const potResult = await prisma.payment.aggregate({
      where: { ticket: { gameId: game.id }, status: 'approved' },
      _sum: { amount: true },
    });

    res.json({
      id: game.id,
      name: game.name,
      startDate: game.startDate,
      status: game.status,
      totalPot: Number(potResult._sum.amount || 0).toFixed(2),
      accumulatedNumbers: game.accumulatedNumbers,
      drawCount: game.drawCount,
      activeTickets: game._count.tickets,
      draws: game.draws,
      ticketPrice: parseFloat(process.env.TICKET_PRICE_BRL || '30.00'),
      prizeDistribution: {
        sixHits: '65%',
        peQuente: '10%',
        peFrio: '5%',
        house: '20%',
      },
    });
  } catch (err) {
    logger.safeError('Erro ao buscar jogo', err);
    res.status(500).json({ error: 'Erro ao buscar jogo.' });
  }
}

/**
 * POST /api/game/tickets
 * Cria cartela(s) pendentes de pagamento e retorna QR PIX.
 * Body: { numbers: [[n1..n6], [n1..n6], ...] }  — array de cartelas
 */
async function createTickets(req, res) {
  try {
    const { numbers } = req.body; // Array de arrays de números
    const userId = req.user.id;

    const game = await getActiveGame();
    if (!game) {
      return res.status(400).json({ error: 'Nenhum jogo ativo no momento.' });
    }

    if (!Array.isArray(numbers) || numbers.length === 0) {
      return res.status(422).json({ error: 'Envie ao menos uma cartela.' });
    }

    if (numbers.length > 50) {
      return res.status(422).json({ error: 'Máximo de 50 cartelas por compra.' });
    }

    // Valida todos os conjuntos de números
    const validatedSets = [];
    for (let i = 0; i < numbers.length; i++) {
      const result = validateNumbers(numbers[i]);
      if (!result.valid) {
        return res.status(422).json({ error: `Cartela ${i + 1}: ${result.error}` });
      }
      validatedSets.push(result.numbers);
    }

    const totalAmount = TICKET_PRICE * validatedSets.length;
    const idempotencyKey = uuidv4();

    // Cria todas as cartelas + payment em transação
    let ticketIds = [];
    let paymentRecord;

    await prisma.$transaction(async (tx) => {
      const createdTickets = [];
      for (const nums of validatedSets) {
        const ticket = await tx.ticket.create({
          data: {
            userId,
            gameId: game.id,
            numbers: nums,
            status: 'pending_payment',
          },
        });
        createdTickets.push(ticket);
      }

      ticketIds = createdTickets.map((t) => t.id);

      // Um único payment cobre todas as cartelas desta compra
      // Usa a primeira cartela como referência (external_reference do MP)
      paymentRecord = await tx.payment.create({
        data: {
          ticketId: createdTickets[0].id,
          amount: totalAmount.toFixed(2),
          status: 'pending',
        },
      });
    });

    // Gera QR PIX via Mercado Pago
    let pixData;
    try {
      pixData = await createPixPayment({
        ticketId: ticketIds[0],
        payerNickname: req.user.nickname,
        amount: totalAmount,
        idempotencyKey,
      });

      await prisma.payment.update({
        where: { id: paymentRecord.id },
        data: {
          mpPaymentId: pixData.mpPaymentId,
          qrCode: pixData.qrCode,
          qrCodeBase64: pixData.qrCodeBase64,
          pixCode: pixData.pixCode,
          expiresAt: pixData.expiresAt,
        },
      });
    } catch (mpErr) {
      logger.safeError('Erro ao gerar PIX no Mercado Pago', mpErr, { ticketIds });
      // Retorna com fallback WhatsApp
      return res.status(200).json({
        ticketIds,
        totalAmount: totalAmount.toFixed(2),
        paymentStatus: 'pending',
        pixError: true,
        fallback: {
          message: 'Falha ao gerar QR Code. Envie comprovante pelo WhatsApp.',
          whatsapp: process.env.ADMIN_WHATSAPP,
        },
      });
    }

    res.status(201).json({
      ticketIds,
      totalAmount: totalAmount.toFixed(2),
      paymentId: paymentRecord.id,
      paymentStatus: 'pending',
      pix: {
        qrCodeBase64: pixData.qrCodeBase64,
        pixCode: pixData.pixCode,
        expiresAt: pixData.expiresAt,
      },
    });
  } catch (err) {
    logger.safeError('Erro ao criar cartelas', err);
    res.status(500).json({ error: 'Erro ao criar cartelas.' });
  }
}

/**
 * GET /api/game/tickets/my
 * Lista cartelas do usuário autenticado.
 */
async function getMyTickets(req, res) {
  try {
    const tickets = await prisma.ticket.findMany({
      where: { userId: req.user.id },
      include: {
        game: { select: { id: true, name: true, status: true, drawCount: true } },
        // pixCode e expiresAt omitidos — não expõe código PIX na listagem geral
        payment: { select: { status: true, paidAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(tickets);
  } catch (err) {
    logger.safeError('Erro ao listar cartelas', err);
    res.status(500).json({ error: 'Erro ao listar cartelas.' });
  }
}

/**
 * GET /api/game/tickets/:id
 * Detalhe de uma cartela específica do usuário.
 */
async function getTicketById(req, res) {
  try {
    const { id } = req.params;
    const ticket = await prisma.ticket.findFirst({
      where: { id, userId: req.user.id },
      include: {
        game: true,
        // pixCode omitido — quem precisa do código usa o endpoint de pagamento
        payment: { select: { status: true, paidAt: true, expiresAt: true } },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Cartela não encontrada.' });
    }

    res.json(ticket);
  } catch (err) {
    logger.safeError('Erro ao buscar cartela', err);
    res.status(500).json({ error: 'Erro ao buscar cartela.' });
  }
}

/**
 * GET /api/game/ranking
 * Retorna ranking público de jogadores ordenado por acertos (maior → menor).
 * Mostra apenas cartelas ativas ou ganhadoras do jogo mais recente.
 */
async function getRanking(req, res) {
  try {
    const game = await prisma.game.findFirst({
      where: { status: { in: ['active', 'finished'] } },
      orderBy: { createdAt: 'desc' },
      include: {
        draws: {
          orderBy: { drawOrder: 'desc' },
          select: { id: true, drawDate: true, numbers: true, drawOrder: true },
        },
      },
    });

    if (!game) {
      return res.json({ ranking: [], game: null });
    }

    const tickets = await prisma.ticket.findMany({
      where: {
        gameId: game.id,
        status: { in: ['active', 'winner'] },
      },
      include: {
        user: { select: { nickname: true } },
      },
      orderBy: [
        { totalHits: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    const ranking = tickets.map((t, index) => ({
      position: index + 1,
      nickname: t.user.nickname,
      numbers: t.numbers,
      totalHits: t.totalHits,
      hitHistory: Array.isArray(t.hitHistory) ? t.hitHistory : [],
      status: t.status,
      isPeQuente: t.isPeQuente,
      isPeFrio: t.isPeFrio,
      prizeAmount: t.prizeAmount ? Number(t.prizeAmount) : null,
    }));

    res.json({
      ranking,
      game: {
        id: game.id,
        name: game.name,
        status: game.status,
        drawCount: game.drawCount,
        accumulatedNumbers: game.accumulatedNumbers,
        draws: game.draws,
      },
    });
  } catch (err) {
    logger.safeError('Erro ao buscar ranking', err);
    res.status(500).json({ error: 'Erro ao buscar ranking.' });
  }
}

/**
 * GET /api/game/mega-sena/latest
 * Endpoint público — retorna o último resultado da Mega Sena da Caixa.
 */
async function getLatestMegaSena(req, res) {
  try {
    const result = await megaSenaService.fetchLatestResult();
    res.json(result);
  } catch (err) {
    logger.safeError('Erro ao buscar resultado Mega Sena (público)', err);
    res.status(503).json({ error: 'Não foi possível obter o resultado da Mega Sena agora. Tente novamente em breve.' });
  }
}

module.exports = { getCurrentGame, createTickets, getMyTickets, getTicketById, getRanking, getLatestMegaSena };
