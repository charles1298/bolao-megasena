const router = require('express').Router();
const { param } = require('express-validator');
const { handleWebhook, checkPaymentStatus } = require('../controllers/paymentController');
const { authenticate } = require('../middlewares/auth');
const { webhookLimiter } = require('../middlewares/rateLimiter');
const { validate } = require('../middlewares/validate');

// POST /api/payments/webhook — chamado pelo Mercado Pago (sem JWT)
// Body raw é necessário para validação de assinatura
router.post('/webhook', webhookLimiter, handleWebhook);

// POST /api/payments/check/:paymentId — autenticado (polling manual)
router.post(
  '/check/:paymentId',
  authenticate,
  [param('paymentId').isUUID().withMessage('ID inválido.')],
  validate,
  checkPaymentStatus
);

module.exports = router;
