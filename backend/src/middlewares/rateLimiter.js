const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redisClient = require('../services/redisClient');

// Cria um RedisStore com fallback silencioso se Redis estiver indisponível
function makeStore(prefix) {
  return new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: `rl:${prefix}:`,
  });
}

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('general'),
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
  skipSuccessfulRequests: false,
});

const publicLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('public'),
  message: { error: 'Muitas requisições. Aguarde 1 minuto.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('login'),
  message: {
    error: 'Muitas tentativas de login. Conta bloqueada por 15 minutos.',
    code: 'LOGIN_BLOCKED',
  },
  skipSuccessfulRequests: true,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('register'),
  message: { error: 'Limite de cadastros atingido. Tente em 1 hora.' },
});

const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('webhook'),
  message: { error: 'Rate limit excedido para webhooks.' },
});

const paymentCheckLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('payment_check'),
  message: { error: 'Muitas verificações de pagamento. Aguarde 1 minuto.' },
  skipSuccessfulRequests: false,
});

const adminSensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('admin_sensitive'),
  message: { error: 'Limite de operações administrativas atingido. Tente em 1 hora.' },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('refresh'),
  message: { error: 'Muitas renovações de sessão. Tente novamente em 15 minutos.' },
});

const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('password_change'),
  message: { error: 'Limite de alterações de senha atingido. Tente em 1 hora.' },
});

module.exports = {
  generalLimiter,
  publicLimiter,
  loginLimiter,
  registerLimiter,
  webhookLimiter,
  paymentCheckLimiter,
  adminSensitiveLimiter,
  refreshLimiter,
  passwordChangeLimiter,
};
