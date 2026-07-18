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
      .withMessage('Senha deve ter entre 8 e 128 caracteres.')
      .matches(/[A-Z]/)
      .withMessage('Senha deve conter ao menos uma letra maiúscula.')
      .matches(/\d/)
      .withMessage('Senha deve conter ao menos um número.'),
    body('whatsapp')
      .notEmpty()
      .withMessage('WhatsApp é obrigatório para contato sobre pagamentos.')
      .bail()
      .matches(/^(55\d{10,11}|\d{10,11})$/)
      .withMessage('WhatsApp inválido. Use DDD + número (ex: 5511999999999).'),
    body('cpf')
      .notEmpty()
      .withMessage('CPF é obrigatório para verificação de idade e emissão de comprovante de prêmio.')
      .bail()
      .customSanitizer((v) => String(v || '').replace(/\D/g, ''))
      .isLength({ min: 11, max: 11 })
      .withMessage('CPF deve ter 11 dígitos.'),
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
