const router = require('express').Router();
const { body, param, query } = require('express-validator');
const {
  setupTotp,
  confirmTotp,
  createGame,
  activateGame,
  deleteGame,
  registerDraw,
  processPrizes,
  listUsers,
  listTransactions,
  listTickets,
  deleteTicket,
  exportTicketsCSV,
  exportTransactionsCSV,
  getAdminLogs,
  getDashboard,
  fetchOfficialResult,
  syncOfficialResult,
  approvePayment,
  markPrizePaid,
  resetUserPassword,
  toggleBettingLock,
  setAutoClose,
  getSettings,
  updateSettings,
} = require('../controllers/adminController');
const { authenticate } = require('../middlewares/auth');
const { requireAdmin } = require('../middlewares/admin');
const { validate, sanitizeBody } = require('../middlewares/validate');
const { adminSensitiveLimiter } = require('../middlewares/rateLimiter');

// Todos os endpoints admin exigem JWT + role admin
router.use(authenticate, requireAdmin);

// ─── 2FA TOTP ────────────────────────────────────────────────
router.get('/totp/setup', setupTotp);
router.post(
  '/totp/confirm',
  [body('token').isLength({ min: 6, max: 6 }).isNumeric()],
  validate,
  confirmTotp
);

// ─── Dashboard ───────────────────────────────────────────────
router.get('/dashboard', getDashboard);

// ─── Jogos ───────────────────────────────────────────────────
router.post(
  '/games',
  sanitizeBody,
  [
    body('name').optional().trim().isLength({ max: 100 }),
    body('startDate').isISO8601().withMessage('Data de início inválida.'),
    body('autoCloseAt').optional({ nullable: true }).isISO8601().withMessage('Horário de corte inválido.'),
  ],
  validate,
  createGame
);

router.patch(
  '/games/:id/activate',
  [param('id').isUUID()],
  validate,
  activateGame
);

router.delete(
  '/games/:id',
  adminSensitiveLimiter,
  [param('id').isUUID()],
  validate,
  deleteGame
);

router.patch(
  '/games/:id/betting-lock',
  [param('id').isUUID()],
  validate,
  toggleBettingLock
);

router.patch(
  '/games/:id/auto-close',
  sanitizeBody,
  [
    param('id').isUUID(),
    body('autoCloseAt').optional({ nullable: true }).isISO8601().withMessage('Horário de corte inválido.'),
  ],
  validate,
  setAutoClose
);

// ─── Sorteios ─────────────────────────────────────────────────
router.post(
  '/games/:id/draws',
  adminSensitiveLimiter,
  sanitizeBody,
  [
    param('id').isUUID(),
    body('numbers')
      .isArray({ min: 6, max: 6 })
      .withMessage('Informe exatamente 6 números.')
      .custom((arr) => new Set(arr).size === arr.length)
      .withMessage('Os 6 números do sorteio devem ser únicos.'),
    body('numbers.*')
      .isInt({ min: 1, max: 60 })
      .withMessage('Números devem ser inteiros entre 1 e 60.'),
    body('drawDate').isISO8601().withMessage('Data do sorteio inválida.'),
  ],
  validate,
  registerDraw
);

// ─── Prêmios ──────────────────────────────────────────────────
router.post(
  '/games/:id/prizes',
  adminSensitiveLimiter,
  [param('id').isUUID()],
  validate,
  processPrizes
);

// ─── Usuários ─────────────────────────────────────────────────
router.get(
  '/users',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  listUsers
);

// ─── Cartelas ─────────────────────────────────────────────────
router.get(
  '/tickets',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('gameId').optional().isUUID(),
    query('status').optional().isIn(['active', 'pending_payment', 'winner', 'cancelled']),
  ],
  validate,
  listTickets
);

router.delete(
  '/tickets/:id',
  adminSensitiveLimiter,
  [param('id').isUUID()],
  validate,
  deleteTicket
);

// ─── Transações ───────────────────────────────────────────────
router.get(
  '/transactions',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['pending', 'approved', 'rejected', 'cancelled']),
  ],
  validate,
  listTransactions
);

// ─── Reset de senha de usuário (pelo admin) ───────────────────
router.post(
  '/users/:id/reset-password',
  adminSensitiveLimiter,
  [
    param('id').isUUID(),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Nova senha deve ter ao menos 8 caracteres.')
      .matches(/[A-Z]/).withMessage('Nova senha deve ter ao menos uma letra maiúscula.')
      .matches(/\d/).withMessage('Nova senha deve ter ao menos um número.'),
  ],
  validate,
  resetUserPassword
);

// ─── Aprovação manual de pagamento ────────────────────────────
router.post(
  '/payments/:id/approve',
  [param('id').isUUID()],
  validate,
  approvePayment
);

// ─── Marcar prêmio como pago (auditoria) ──────────────────────
router.post(
  '/tickets/:id/prize-paid',
  sanitizeBody,
  [
    param('id').isUUID(),
    body('notes').optional().isString().isLength({ max: 1000 }),
  ],
  validate,
  markPrizePaid
);

// ─── Exportações CSV ──────────────────────────────────────────
router.get(
  '/reports/tickets.csv',
  [query('gameId').optional().isUUID()],
  validate,
  exportTicketsCSV
);

router.get('/reports/transactions.csv', exportTransactionsCSV);

// ─── Logs ─────────────────────────────────────────────────────
router.get(
  '/logs',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  getAdminLogs
);

// ─── Resultado Oficial Mega Sena ──────────────────────────────
router.get('/mega-sena/latest', fetchOfficialResult);
router.post('/mega-sena/sync', adminSensitiveLimiter, syncOfficialResult);

// ─── Configurações do bolão (datas) ───────────────────────────
router.get('/settings', getSettings);
router.patch(
  '/settings',
  sanitizeBody,
  [
    body('dataInicio').optional().isISO8601().withMessage('Data de início inválida.'),
    body('dataFechamento').optional().isISO8601().withMessage('Data de fechamento inválida.'),
  ],
  validate,
  updateSettings
);

module.exports = router;
