require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

const { generalLimiter } = require('./src/middlewares/rateLimiter');
const { errorHandler, notFoundHandler } = require('./src/middlewares/errorHandler');
const logger = require('./src/utils/logger');

const authRoutes = require('./src/routes/auth');
const gameRoutes = require('./src/routes/game');
const paymentRoutes = require('./src/routes/payment');
const adminRoutes = require('./src/routes/admin');
const userRoutes = require('./src/routes/user');

const app = express();

// ─── Confia no primeiro proxy (necessário para req.ip correto atrás de Nginx) ──
app.set('trust proxy', 1);

// ─── Segurança: HTTP Headers ──────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  })
);

// Permissions-Policy: desativa funcionalidades de browser não usadas pela API
app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
  );
  next();
});

// ─── CORS — apenas frontend autorizado ────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  // Em dev, permite localhost
  ...(process.env.NODE_ENV !== 'production'
    ? ['http://localhost:5173', 'http://localhost:3000']
    : []),
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite requisições sem Origin (wget healthcheck, server-to-server, curl)
      // CORS só se aplica a requisições de browser com Origin header
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origem não permitida: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  })
);

// ─── Compressão ───────────────────────────────────────────────────────────────
app.use(compression());

// ─── Body parsing ─────────────────────────────────────────────────────────────
// Webhook do MP precisa do body raw para validação de assinatura
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// ─── Logging HTTP ─────────────────────────────────────────────────────────────
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
    // Não loga dados sensíveis — apenas método, url, status e timing
    skip: (req) => req.path === '/health',
  })
);

// ─── Cache-Control: no-store em todas as rotas da API ────────────────────────
// Impede que proxies e CDNs cacheiem respostas com dados de usuários
app.use('/api/', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  next();
});

// ─── Rate limiting global ─────────────────────────────────────────────────────
app.use('/api/', generalLimiter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Nota: redirecionamento HTTP→HTTPS deve ser feito no reverse proxy (Nginx/Caddy)
// não no backend, pois o backend nunca vê o protocolo externo diretamente.

// ─── Rotas ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);

// ─── 404 e Error handlers ─────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3001', 10);
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Servidor iniciado na porta ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

// ─── Limpeza periódica de dados temporários ───────────────────────────────────
// Remove LoginAttempts com mais de 30 dias para não inflar o banco
async function cleanupOldLoginAttempts() {
  try {
    const { prisma } = require('./src/services/prismaClient');
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { count } = await prisma.loginAttempt.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (count > 0) logger.info(`Limpeza: ${count} LoginAttempts antigas removidas.`);
  } catch (err) {
    logger.safeError('Erro na limpeza de LoginAttempts', err);
  }
}

// Remove refresh tokens expirados do banco (mantém tabela enxuta)
async function cleanupExpiredRefreshTokens() {
  try {
    const { prisma } = require('./src/services/prismaClient');
    const { count } = await prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (count > 0) logger.info(`Limpeza: ${count} RefreshTokens expirados removidos.`);
  } catch (err) {
    logger.safeError('Erro na limpeza de RefreshTokens', err);
  }
}

// Roda a limpeza 1 hora após o boot, depois a cada 24 horas
setTimeout(() => {
  cleanupOldLoginAttempts();
  cleanupExpiredRefreshTokens();
  setInterval(() => {
    cleanupOldLoginAttempts();
    cleanupExpiredRefreshTokens();
  }, 24 * 60 * 60 * 1000);
}, 60 * 60 * 1000);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM recebido — encerrando servidor...');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  logger.error('uncaughtException', { message: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection', { reason: String(reason) });
});

module.exports = app;
