const router = require('express').Router();
const { body } = require('express-validator');
const { getProfile, updateProfile, getMyStats, changePassword } = require('../controllers/userController');
const { authenticate } = require('../middlewares/auth');
const { validate, sanitizeBody } = require('../middlewares/validate');

router.use(authenticate);

router.get('/me', getProfile);

router.patch(
  '/me',
  sanitizeBody,
  [
    body('whatsapp')
      .optional({ nullable: true })
      .matches(/^\d{10,15}$/)
      .withMessage('WhatsApp inválido.'),
  ],
  validate,
  updateProfile
);

router.get('/me/stats', getMyStats);

router.put(
  '/me/password',
  sanitizeBody,
  [
    body('currentPassword').notEmpty().withMessage('Senha atual obrigatória.'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Nova senha deve ter ao menos 8 caracteres.')
      .matches(/[A-Z]/).withMessage('Nova senha deve ter ao menos uma letra maiúscula.')
      .matches(/\d/).withMessage('Nova senha deve ter ao menos um número.'),
  ],
  validate,
  changePassword
);

module.exports = router;
