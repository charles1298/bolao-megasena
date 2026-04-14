const router = require('express').Router();
const { body, param } = require('express-validator');
const {
  getCurrentGame,
  createTickets,
  getMyTickets,
  getTicketById,
  getRanking,
  getLatestMegaSena,
} = require('../controllers/gameController');
const { authenticate } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

// GET /api/game/current — público
router.get('/current', getCurrentGame);

// GET /api/game/ranking — público
router.get('/ranking', getRanking);

// GET /api/game/mega-sena/latest — público
router.get('/mega-sena/latest', getLatestMegaSena);

// POST /api/game/tickets — autenticado
router.post(
  '/tickets',
  authenticate,
  [
    body('numbers')
      .isArray({ min: 1, max: 50 })
      .withMessage('Envie entre 1 e 50 cartelas.'),
    body('numbers.*')
      .isArray({ min: 6, max: 6 })
      .withMessage('Cada cartela deve ter exatamente 6 números.')
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

module.exports = router;
