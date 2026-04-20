const { prisma } = require('../services/prismaClient');
const { generateSecret, verifyToken } = require('../services/totpService');
const { processDraw, validateNumbers } = require('../services/gameService');
const { distributePrizes } = require('../services/prizeService');
const { logAdminAction } = require('../middlewares/admin');
const { ticketsToCSV, transactionsToCSV } = require('../utils/csvExport');
const megaSenaService = require('../services/megaSenaService');
const logger = require('../utils/logger');

/**
 * GET /api/admin/totp/setup
 * Gera segredo TOTP para o admin (uso único no setup).
 */
async function setupTotp(req, res) {
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (admin.totpEnabled) {
      return res.status(400).json({ error: '2FA já está ativo. Desative primeiro.' });
    }

    const { secret, qrCodeDataUrl, otpAuthUrl } = await generateSecret(admin.nickname);

    // Salva segredo temporariamente (confirmação pendente)
    await prisma.user.update({
      where: { id: admin.id },
      data: { totpSecret: secret },
    });

    res.json({ qrCodeDataUrl, otpAuthUrl, secret });
  } catch (err) {
    logger.safeError('Erro no setup TOTP', err);
    res.status(500).json({ error: 'Erro ao configurar 2FA.' });
  }
}

/**
 * POST /api/admin/totp/confirm
 * Confirma e ativa o TOTP com um código do autenticador.
 */
async function confirmTotp(req, res) {
  try {
    const { token } = req.body;
    const admin = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!admin.totpSecret) {
      return res.status(400).json({ error: 'Execute o setup do 2FA primeiro.' });
    }
    if (admin.totpEnabled) {
      return res.status(400).json({ error: '2FA já está ativo.' });
    }

    if (!verifyToken(token, admin.totpSecret)) {
      return res.status(401).json({ error: 'Código 2FA inválido.' });
    }

    await prisma.user.update({
      where: { id: admin.id },
      data: { totpEnabled: true },
    });

    await logAdminAction(admin.id, 'TOTP_ENABLED', {}, req.ip);
    res.json({ message: '2FA ativado com sucesso.' });
  } catch (err) {
    logger.safeError('Erro ao confirmar TOTP', err);
    res.status(500).json({ error: 'Erro ao ativar 2FA.' });
  }
}

/**
 * POST /api/admin/games
 * Cria novo jogo.
 */
async function createGame(req, res) {
  try {
    const { name, startDate } = req.body;

    // Não pode ter jogo ativo simultâneo
    const existingActive = await prisma.game.findFirst({
      where: { status: { in: ['active', 'pending'] } },
    });
    if (existingActive) {
      return res.status(409).json({ error: 'Já existe um jogo ativo ou pendente.' });
    }

    const game = await prisma.game.create({
      data: {
        name: name || 'Bolão Mega Sena',
        startDate: new Date(startDate),
        status: new Date(startDate) <= new Date() ? 'active' : 'pending',
      },
    });

    await logAdminAction(req.user.id, 'GAME_CREATED', { gameId: game.id, name: game.name }, req.ip);
    logger.info('Jogo criado', { gameId: game.id, adminId: req.user.id });

    res.status(201).json(game);
  } catch (err) {
    logger.safeError('Erro ao criar jogo', err);
    res.status(500).json({ error: 'Erro ao criar jogo.' });
  }
}

/**
 * PATCH /api/admin/games/:id/activate
 * Ativa um jogo pendente.
 */
async function activateGame(req, res) {
  try {
    const { id } = req.params;
    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) return res.status(404).json({ error: 'Jogo não encontrado.' });
    if (game.status === 'active') return res.status(400).json({ error: 'Jogo já está ativo.' });

    const updated = await prisma.game.update({
      where: { id },
      data: { status: 'active' },
    });

    await logAdminAction(req.user.id, 'GAME_ACTIVATED', { gameId: id }, req.ip);
    res.json(updated);
  } catch (err) {
    logger.safeError('Erro ao ativar jogo', err);
    res.status(500).json({ error: 'Erro ao ativar jogo.' });
  }
}

/**
 * POST /api/admin/games/:id/draws
 * Registra resultado de sorteio da Mega Sena.
 * Body: { numbers: [n1, n2, n3, n4, n5, n6], drawDate: "ISO date" }
 */
async function registerDraw(req, res) {
  try {
    const { id } = req.params;
    const { numbers, drawDate } = req.body;

    const numValidation = validateNumbers(numbers);
    if (!numValidation.valid) {
      return res.status(422).json({ error: numValidation.error });
    }

    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) return res.status(404).json({ error: 'Jogo não encontrado.' });
    if (game.status !== 'active') return res.status(400).json({ error: 'Jogo não está ativo.' });

    const result = await processDraw(id, numValidation.numbers, new Date(drawDate));

    await logAdminAction(req.user.id, 'DRAW_REGISTERED', {
      gameId: id,
      numbers: numValidation.numbers,
      drawDate,
      winners: result.winners.length,
    }, req.ip);

    res.json({
      draw: result.draw,
      winners: result.winners.length,
      peQuente: result.peQuente.length,
      peFrio: result.peFrio.length,
      gameFinished: result.winners.length > 0,
    });
  } catch (err) {
    logger.safeError('Erro ao registrar sorteio', err);
    res.status(500).json({ error: 'Erro ao registrar sorteio.' });
  }
}

/**
 * POST /api/admin/games/:id/prizes
 * Processa distribuição de prêmios (após ganhador encontrado).
 */
async function processPrizes(req, res) {
  try {
    const { id } = req.params;

    const distribution = await distributePrizes(id);

    await logAdminAction(req.user.id, 'PRIZES_DISTRIBUTED', {
      gameId: id,
      totalPot: distribution.totalPot,
    }, req.ip);

    res.json(distribution);
  } catch (err) {
    logger.safeError('Erro ao processar prêmios', err);
    res.status(500).json({ error: err.message || 'Erro ao processar prêmios.' });
  }
}

/**
 * GET /api/admin/users
 * Lista todos os usuários (paginado).
 */
async function listUsers(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1'));
    const limit = Math.min(100, parseInt(req.query.limit || '20'));
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true, nickname: true, whatsapp: true,
          role: true, isActive: true, createdAt: true,
          _count: { select: { tickets: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count(),
    ]);

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.safeError('Erro ao listar usuários', err);
    res.status(500).json({ error: 'Erro ao listar usuários.' });
  }
}

/**
 * GET /api/admin/transactions
 * Lista todas as transações.
 */
async function listTransactions(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1'));
    const limit = Math.min(100, parseInt(req.query.limit || '20'));
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const where = status ? { status } : {};

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        include: {
          ticket: {
            include: { user: { select: { id: true, nickname: true, whatsapp: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({ payments, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.safeError('Erro ao listar transações', err);
    res.status(500).json({ error: 'Erro ao listar transações.' });
  }
}

/**
 * GET /api/admin/reports/tickets.csv
 */
async function exportTicketsCSV(req, res) {
  try {
    const { gameId } = req.query;
    const where = gameId ? { gameId } : {};

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        user: { select: { nickname: true, whatsapp: true } },
        payment: { select: { status: true, paidAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const csv = ticketsToCSV(tickets);
    await logAdminAction(req.user.id, 'EXPORT_TICKETS_CSV', { gameId: gameId || 'all' }, req.ip);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="cartelas.csv"');
    res.send('\uFEFF' + csv); // BOM para Excel
  } catch (err) {
    logger.safeError('Erro ao exportar CSV', err);
    res.status(500).json({ error: 'Erro ao gerar relatório.' });
  }
}

/**
 * GET /api/admin/reports/transactions.csv
 */
async function exportTransactionsCSV(req, res) {
  try {
    const payments = await prisma.payment.findMany({
      include: {
        ticket: {
          include: { user: { select: { nickname: true, whatsapp: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const csv = transactionsToCSV(payments);
    await logAdminAction(req.user.id, 'EXPORT_TRANSACTIONS_CSV', {}, req.ip);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="transacoes.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) {
    logger.safeError('Erro ao exportar CSV transações', err);
    res.status(500).json({ error: 'Erro ao gerar relatório.' });
  }
}

/**
 * GET /api/admin/logs
 * Histórico de ações administrativas.
 */
async function getAdminLogs(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1'));
    const limit = Math.min(100, parseInt(req.query.limit || '50'));
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.adminLog.findMany({
        skip,
        take: limit,
        include: { admin: { select: { nickname: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.adminLog.count(),
    ]);

    res.json({ logs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.safeError('Erro ao buscar logs', err);
    res.status(500).json({ error: 'Erro ao buscar logs.' });
  }
}

/**
 * GET /api/admin/dashboard
 * Resumo geral para o painel.
 */
async function getDashboard(req, res) {
  try {
    const [totalUsers, activeGame, totalRevenue, pendingPayments, recentTickets] =
      await Promise.all([
        prisma.user.count({ where: { role: 'player' } }),
        prisma.game.findFirst({
          where: { status: { in: ['active', 'pending'] } },
          include: { _count: { select: { tickets: { where: { status: 'active' } } } } },
        }),
        prisma.payment.aggregate({
          where: { status: 'approved' },
          _sum: { amount: true },
        }),
        prisma.payment.count({ where: { status: 'pending' } }),
        prisma.ticket.findMany({
          where: { status: 'active' },
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { nickname: true } } },
        }),
      ]);

    res.json({
      totalUsers,
      activeGame: activeGame
        ? {
            id: activeGame.id,
            name: activeGame.name,
            status: activeGame.status,
            activeTickets: activeGame._count.tickets,
            drawCount: activeGame.drawCount,
          }
        : null,
      totalRevenue: Number(totalRevenue._sum.amount || 0).toFixed(2),
      houseCut: (Number(totalRevenue._sum.amount || 0) * 0.20).toFixed(2),
      pendingPayments,
      recentTickets,
    });
  } catch (err) {
    logger.safeError('Erro ao carregar dashboard', err);
    res.status(500).json({ error: 'Erro ao carregar dashboard.' });
  }
}

/**
 * GET /api/admin/mega-sena/latest
 * Busca o último resultado oficial da Mega Sena na API da Caixa (sem salvar).
 */
async function fetchOfficialResult(req, res) {
  try {
    const result = await megaSenaService.fetchLatestResult();
    res.json(result);
  } catch (err) {
    logger.safeError('Erro ao buscar resultado oficial Mega Sena', err);
    res.status(502).json({ error: 'Não foi possível buscar o resultado da Caixa. Tente novamente.' });
  }
}

/**
 * POST /api/admin/mega-sena/sync
 * Busca o último resultado da Caixa e registra automaticamente no jogo ativo.
 * Retorna 409 se o concurso deste dia já foi registrado.
 */
async function syncOfficialResult(req, res) {
  try {
    const official = await megaSenaService.fetchLatestResult();

    const game = await prisma.game.findFirst({
      where: { status: 'active' },
    });

    if (!game) {
      return res.status(400).json({ error: 'Nenhum jogo ativo para sincronizar.' });
    }

    // Verifica se já existe um sorteio registrado para esta data
    const drawDateStart = new Date(official.drawDate);
    drawDateStart.setHours(0, 0, 0, 0);
    const drawDateEnd = new Date(official.drawDate);
    drawDateEnd.setHours(23, 59, 59, 999);

    const alreadyRegistered = await prisma.draw.findFirst({
      where: {
        gameId: game.id,
        drawDate: { gte: drawDateStart, lte: drawDateEnd },
      },
    });

    if (alreadyRegistered) {
      return res.status(409).json({
        error: `Concurso ${official.contestNumber} de ${official.drawDateFormatted} já foi sincronizado.`,
        draw: alreadyRegistered,
      });
    }

    const result = await processDraw(game.id, official.numbers, official.drawDate);

    await logAdminAction(req.user.id, 'DRAW_SYNCED_OFFICIAL', {
      gameId: game.id,
      contestNumber: official.contestNumber,
      numbers: official.numbers,
      drawDate: official.drawDateFormatted,
      winners: result.winners.length,
    }, req.ip);

    logger.info('Sorteio oficial sincronizado', {
      contestNumber: official.contestNumber,
      gameId: game.id,
    });

    res.json({
      official,
      draw: result.draw,
      winners: result.winners.length,
      peQuente: result.peQuente.length,
      peFrio: result.peFrio.length,
      gameFinished: result.winners.length > 0,
    });
  } catch (err) {
    logger.safeError('Erro ao sincronizar resultado oficial', err);
    res.status(500).json({ error: err.message || 'Erro ao sincronizar resultado.' });
  }
}

/**
 * POST /api/admin/users/:id/reset-password
 * Admin redefine a senha de um usuário (sem precisar da senha atual).
 */
async function resetUserPassword(req, res) {
  const bcrypt = require('bcrypt');
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    const hash = await bcrypt.hash(newPassword, rounds);

    // Altera senha e invalida todas as sessões do usuário simultaneamente
    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { passwordHash: hash } }),
      prisma.refreshToken.deleteMany({ where: { userId: id } }),
    ]);

    await logAdminAction(req.user.id, 'USER_PASSWORD_RESET', { targetUserId: id, nickname: user.nickname }, req.ip);
    logger.info('Senha redefinida pelo admin — sessões revogadas', { targetUserId: id, adminId: req.user.id });

    res.json({ message: `Senha de ${user.nickname} redefinida. Todas as sessões foram encerradas.` });
  } catch (err) {
    logger.safeError('Erro ao redefinir senha', err);
    res.status(500).json({ error: 'Erro ao redefinir senha.' });
  }
}

/**
 * POST /api/admin/payments/:id/approve
 * Aprova manualmente um pagamento pendente e ativa a cartela.
 */
async function approvePayment(req, res) {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        ticket: { select: { id: true, gameId: true, userId: true, status: true } },
      },
    });

    if (!payment) return res.status(404).json({ error: 'Pagamento não encontrado.' });
    if (payment.status === 'approved') return res.status(400).json({ error: 'Pagamento já aprovado.' });

    const updates = [
      prisma.payment.update({
        where: { id },
        data: { status: 'approved', paidAt: new Date() },
      }),
    ];

    if (payment.ticket.status === 'pending_payment') {
      updates.push(
        prisma.ticket.update({
          where: { id: payment.ticket.id },
          data: { status: 'active' },
        })
      );
      updates.push(
        prisma.game.update({
          where: { id: payment.ticket.gameId },
          data: { totalPot: { increment: Number(payment.amount) } },
        })
      );
    }

    await prisma.$transaction(updates);

    await logAdminAction(req.user.id, 'PAYMENT_APPROVED_MANUAL', {
      paymentId: id,
      ticketId: payment.ticket.id,
      amount: payment.amount,
    }, req.ip);

    logger.info('Pagamento aprovado manualmente', { paymentId: id, adminId: req.user.id });

    res.json({ message: 'Pagamento aprovado e cartela ativada.' });
  } catch (err) {
    logger.safeError('Erro ao aprovar pagamento', err);
    res.status(500).json({ error: 'Erro ao aprovar pagamento.' });
  }
}

module.exports = {
  setupTotp,
  confirmTotp,
  createGame,
  activateGame,
  registerDraw,
  processPrizes,
  listUsers,
  listTransactions,
  exportTicketsCSV,
  exportTransactionsCSV,
  getAdminLogs,
  getDashboard,
  fetchOfficialResult,
  syncOfficialResult,
  approvePayment,
  resetUserPassword,
};
