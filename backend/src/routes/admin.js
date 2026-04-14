const router = require('express').Router();
const { body, param, query } = require('express-validator');
const {
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
} = require('../controllers/adminController');
const { authenticate } = require('../middlewares/auth');
const { requireAdmin } = require('../middlewares/admin');
const { validate, sanitizeBody } = require('../middlewares/validate');

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

// ─── Sorteios ─────────────────────────────────────────────────
router.post(
  '/games/:id/draws',
  sanitizeBody,
  [
    param('id').isUUID(),
    body('numbers')
      .isArray({ min: 6, max: 6 })
      .withMessage('Informe exatamente 6 números.'),
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
  [param('id').isUUID(), body('newPassword').isLength({ min: 6 })],
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
router.post('/mega-sena/sync', syncOfficialResult);

module.exports = router;
