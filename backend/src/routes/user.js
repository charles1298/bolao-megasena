const router = require('express').Router();
const { body } = require('express-validator');
const { getProfile, updateProfile, getMyStats } = require('../controllers/userController');
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

module.exports = router;
