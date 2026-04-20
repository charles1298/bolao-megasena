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

/**
 * Rate limiter para polling de status de pagamento.
 * 20 req / minuto por IP — evita spam no endpoint de check.
 */
const paymentCheckLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas verificações de pagamento. Aguarde 1 minuto.' },
  skipSuccessfulRequests: false,
});

/**
 * Rate limiter para operações administrativas sensíveis.
 * 10 req / hora por IP — sorteios, prêmios, reset de senha.
 */
const adminSensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de operações administrativas atingido. Tente em 1 hora.' },
});

/**
 * Rate limiter para o endpoint de refresh de token.
 * 30 req / 15 min por IP.
 */
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas renovações de sessão. Tente novamente em 15 minutos.' },
});

/**
 * Rate limiter para troca de senha.
 * 5 tentativas / hora por IP.
 */
const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de alterações de senha atingido. Tente em 1 hora.' },
});

module.exports = {
  generalLimiter,
  loginLimiter,
  registerLimiter,
  webhookLimiter,
  paymentCheckLimiter,
  adminSensitiveLimiter,
  refreshLimiter,
  passwordChangeLimiter,
};
