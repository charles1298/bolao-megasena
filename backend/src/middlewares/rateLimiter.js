const rateLimit = require('express-rate-limit');

/**
 * Rate limiter geral para todas as rotas da API.
 * 200 req / 15 min por IP.
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
  skipSuccessfulRequests: false,
});

/**
 * Rate limiter estrito para login.
 * 5 tentativas / 15 min por IP.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas tentativas de login. Conta bloqueada por 15 minutos.',
    code: 'LOGIN_BLOCKED',
  },
  skipSuccessfulRequests: true, // não penaliza logins corretos
});

/**
 * Rate limiter para cadastro.
 * 10 cadastros / hora por IP.
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de cadastros atingido. Tente em 1 hora.' },
});

/**
 * Rate limiter para webhooks do Mercado Pago.
 * Permite volume alto (MP pode enviar múltiplos eventos).
 */
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit excedido para webhooks.' },
});

module.exports = { generalLimiter, loginLimiter, registerLimiter, webhookLimiter };
