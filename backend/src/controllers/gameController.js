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
      return res.json(null);
    }

    // Janela de visibilidade: jogo só aparece 7 dias antes do startDate
    const now = new Date();
    const VISIBILITY_MS = 7 * 24 * 60 * 60 * 1000;
    const visibleFrom = new Date(game.startDate.getTime() - VISIBILITY_MS);

    if (game.status === 'pending' && now < visibleFrom) {
      return res.json(null);
    }

    // isOpen = ativo + não travado manualmente + dentro do horário de corte automático
    const pastCutoff = game.autoCloseAt && now >= new Date(game.autoCloseAt);
    const isOpen = game.status === 'active' && !game.bettingLocked && !pastCutoff;

    // Calcula pot atual
    const potResult = await prisma.payment.aggregate({
      where: { ticket: { gameId: game.id }, status: 'approved' },
      _sum: { amount: true },
    });

    const totalPot = Number(potResult._sum.amount || 0);

    res.json({
      id: game.id,
      name: game.name,
      startDate: game.startDate,
      visibleFrom,
      isOpen,
      bettingLocked: game.bettingLocked,
      autoCloseAt: game.autoCloseAt,
      status: game.status,
      totalPot: totalPot.toFixed(2),
      estimatedPrize: (totalPot * 0.79).toFixed(2),
      accumulatedNumbers: game.accumulatedNumbers,
      drawCount: game.drawCount,
      activeTickets: game._count.tickets,
      draws: game.draws,
      ticketPrice: parseFloat(process.env.TICKET_PRICE_BRL || '30.00'),
      prizeDistribution: {
        winner: '79%',
        house: '20%',
        gateway: '1%',
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
 * Body: { numbers: [[n1..n8], [n1..n8], ...] }  — array de cartelas (8 números cada)
 */
async function createTickets(req, res) {
  try {
    const { numbers } = req.body; // Array de arrays de números
    const userId = req.user.id;

    const game = await getActiveGame();
    if (!game) {
      return res.status(400).json({ error: 'Nenhum jogo ativo no momento.' });
    }

    // Bloqueia apostas se o admin travou manualmente
    if (game.bettingLocked) {
      return res.status(423).json({ error: 'As apostas estão encerradas pelo administrador.' });
    }

    // Bloqueia apostas se passou do horário de corte automático
    if (game.autoCloseAt && new Date() >= new Date(game.autoCloseAt)) {
      const hora = new Date(game.autoCloseAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
      return res.status(423).json({ error: `Apostas encerradas automaticamente às ${hora}.` });
    }

    if (!Array.isArray(numbers) || numbers.length === 0) {
      return res.status(422).json({ error: 'Envie ao menos uma cartela.' });
    }

    if (numbers.length > 50) {
      return res.status(422).json({ error: 'Máximo de 50 cartelas por compra.' });
    }

    // Valida todos os conjuntos de números
    const accumulated = Array.isArray(game.accumulatedNumbers) ? game.accumulatedNumbers : [];
    const validatedSets = [];
    for (let i = 0; i < numbers.length; i++) {
      const result = validateNumbers(numbers[i]);
      if (!result.valid) {
        return res.status(422).json({ error: `Cartela ${i + 1}: ${result.error}` });
      }
      // Bloqueia números já sorteados (impede aposta retroativa em números acumulados)
      const blocked = result.numbers.filter((n) => accumulated.includes(n));
      if (blocked.length > 0) {
        return res.status(422).json({
          error: `Cartela ${i + 1}: número(s) ${blocked.map((n) => String(n).padStart(2, '0')).join(', ')} já foi(ram) sorteado(s) e não pode(m) ser apostado(s).`,
        });
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

    // Campeões de rodadas anteriores (jogos já finalizados) — mantém o
    // ganhador anterior visível mesmo depois de abrir uma nova rodada.
    const championTickets = await prisma.ticket.findMany({
      where: { status: 'winner', game: { status: 'finished' } },
      include: {
        user: { select: { nickname: true } },
        game: { select: { id: true, name: true, updatedAt: true } },
      },
      orderBy: { game: { updatedAt: 'desc' } },
      take: 20,
    });

    const champions = championTickets
      .filter((t) => t.gameId !== game.id) // não repete o jogo já exibido acima
      .map((t) => ({
        nickname: t.user.nickname,
        gameName: t.game.name,
        date: t.game.updatedAt,
        totalHits: t.totalHits,
        prizeAmount: t.prizeAmount ? Number(t.prizeAmount) : null,
      }));

    res.json({
      ranking,
      champions,
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

async function getPublicSettings(req, res) {
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { in: ['data_inicio', 'data_fechamento'] } },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json({
      dataInicio:     map['data_inicio']     ?? null,
      dataFechamento: map['data_fechamento'] ?? null,
    });
  } catch {
    res.json({ dataInicio: null, dataFechamento: null });
  }
}

module.exports = { getCurrentGame, createTickets, getMyTickets, getTicketById, getRanking, getLatestMegaSena, getPublicSettings };
