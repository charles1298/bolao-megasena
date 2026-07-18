const router = require('express').Router();
const { body, param } = require('express-validator');
const {
  getCurrentGame,
  createTickets,
  getMyTickets,
  getTicketById,
  getRanking,
  getLatestMegaSena,
  getPublicSettings,
} = require('../controllers/gameController');
const { authenticate } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { publicLimiter } = require('../middlewares/rateLimiter');

// GET /api/game/current — público
router.get('/current', publicLimiter, getCurrentGame);

// GET /api/game/settings — público (datas do bolão)
router.get('/settings', publicLimiter, getPublicSettings);

// GET /api/game/ranking — público
router.get('/ranking', publicLimiter, getRanking);

// GET /api/game/mega-sena/latest — público
router.get('/mega-sena/latest', publicLimiter, getLatestMegaSena);

// POST /api/game/tickets — autenticado
router.post(
  '/tickets',
  authenticate,
  [
    body('numbers')
      .isArray({ min: 1, max: 50 })
      .withMessage('Envie entre 1 e 50 cartelas.'),
    body('numbers.*')
      .isArray({ min: 8, max: 8 })
      .withMessage('Cada cartela deve ter exatamente 8 números.')
      .custom((arr) => arr.every((n) => Number.isInteger(Number(n)) && n >= 1 && n <= 60))
      .withMessage('Cada número deve ser inteiro entre 1 e 60.'),
  ],
  validate,
  createTickets
);

// GET /api/game/tickets/my — autenticado
router.get('/tickets/my', authenticate, getMyTickets);

// GET /api/game/tickets/:id — autenticado
router.get(
  '/tickets/:id',
  authenticate,
  [param('id').isUUID().withMessage('ID inválido.')],
  validate,
  getTicketById
);

// Nota: a rota DELETE /api/game/tickets/:id foi removida.
// Cancelamento de cartelas agora é restrito ao admin via DELETE /api/admin/tickets/:id.

module.exports = router;
