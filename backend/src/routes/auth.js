const router = require('express').Router();
const { body } = require('express-validator');
const { register, login, refresh, logout } = require('../controllers/authController');
const { loginLimiter, registerLimiter, refreshLimiter } = require('../middlewares/rateLimiter');
const { validate, sanitizeBody } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');

// POST /api/auth/register
router.post(
  '/register',
  registerLimiter,
  sanitizeBody,
  [
    body('nickname')
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Apelido deve ter entre 3 e 30 caracteres.')
      .matches(/^[a-zA-Z0-9_\- ]+$/)
      .withMessage('Apelido pode conter letras, números, espaço, _ e -.'),
    body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Senha deve ter entre 8 e 128 caracteres.'),
    body('whatsapp')
      .optional()
      .matches(/^\d{10,15}$/)
      .withMessage('WhatsApp deve conter apenas dígitos (10 a 15).'),
  ],
  validate,
  register
);

// POST /api/auth/login
router.post(
  '/login',
  loginLimiter,
  sanitizeBody,
  [
    body('nickname').trim().notEmpty().withMessage('Apelido obrigatório.'),
    body('password').notEmpty().withMessage('Senha obrigatória.'),
    body('totpToken')
      .optional()
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage('Código 2FA deve ter 6 dígitos.'),
  ],
  validate,
  login
);

// POST /api/auth/refresh
router.post(
  '/refresh',
  refreshLimiter,
  [body('refreshToken').notEmpty().withMessage('Refresh token obrigatório.')],
  validate,
  refresh
);

// POST /api/auth/logout
router.post('/logout', authenticate, logout);

module.exports = router;
