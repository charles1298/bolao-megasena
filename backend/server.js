require('dotenv').config();

// ─── Guard de configuração: aborta o boot se algum secret crítico estiver ─────
// ausente ou fraco em produção. Roda ANTES de qualquer outra coisa.
const { validateEnv } = require('./src/utils/validateEnv');
validateEnv();

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

// ─── Validação de ambiente (fail-fast) ────────────────────────────────────────
// Falha imediatamente no boot se faltar configuração crítica, em vez de quebrar
// silenciosamente no primeiro login/pagamento em produção.
(function assertEnv() {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    logger.error(`FATAL: variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Avisos (não fatais) para configs recomendadas em produção
  const recommended = ['MP_ACCESS_TOKEN', 'MP_WEBHOOK_SECRET', 'TOTP_ENCRYPTION_KEY', 'FRONTEND_URL'];
  const missingRec = recommended.filter((k) => !process.env[k]);
  if (missingRec.length > 0) {
    logger.warn(`Configuração recomendada ausente: ${missingRec.join(', ')} — algumas funções podem ficar indisponíveis.`);
  }

  // TOTP_ENCRYPTION_KEY precisa ter 64 hex (32 bytes); caso contrário a cifra é
  // silenciosamente desabilitada (segredo TOTP gravado em texto plano).
  if (process.env.TOTP_ENCRYPTION_KEY && process.env.TOTP_ENCRYPTION_KEY.length !== 64) {
    logger.warn('TOTP_ENCRYPTION_KEY não tem 64 caracteres hex — a cifra do segredo 2FA será ignorada.');
  }
})();

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
        styleSrc: ["'self'"],
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
  // Permite localhost apenas quando NODE_ENV é explicitamente 'development'
  ...(process.env.NODE_ENV === 'development'
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
// /health        — leve, só responde "ok" (pra load balancer/uptime monitor)
// /health/deep   — verifica conectividade real com Postgres e Redis
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.get('/health/deep', async (req, res) => {
  const result = {
    status: 'ok',
    ts: new Date().toISOString(),
    checks: {},
  };
  const start = Date.now();

  // Postgres: SELECT 1 com timeout de 3s
  try {
    const { prisma } = require('./src/services/prismaClient');
    const dbStart = Date.now();
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, rej) => setTimeout(() => rej(new Error('db timeout')), 3000)),
    ]);
    result.checks.db = { status: 'ok', latencyMs: Date.now() - dbStart };
  } catch (err) {
    result.checks.db = { status: 'fail', error: err.message };
    result.status = 'degraded';
  }

  // Redis: PING com timeout de 2s (não fail-fail se Redis cair, só degrada)
  try {
    const redisClient = require('./src/services/redisClient');
    if (!redisClient.isReady) {
      result.checks.redis = { status: 'fail', error: 'not ready' };
      result.status = result.status === 'ok' ? 'degraded' : result.status;
    } else {
      const redisStart = Date.now();
      await Promise.race([
        redisClient.ping(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('redis timeout')), 2000)),
      ]);
      result.checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart };
    }
  } catch (err) {
    result.checks.redis = { status: 'fail', error: err.message };
    result.status = result.status === 'ok' ? 'degraded' : result.status;
  }

  result.totalLatencyMs = Date.now() - start;
  // 200 se tudo OK, 503 se algo crítico falhou
  res.status(result.status === 'ok' ? 200 : 503).json(result);
});

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

// ─── Fechamento automático de apostas (scheduler) ────────────────────────────
// Verifica a cada 60s se algum jogo ativo passou do horário de corte (autoCloseAt)
// e trava as apostas automaticamente, sem necessidade de cron externo.
async function checkBettingCutoff() {
  try {
    const { prisma } = require('./src/services/prismaClient');
    const { count } = await prisma.game.updateMany({
      where: {
        status: 'active',
        bettingLocked: false,
        autoCloseAt: { lte: new Date() },
      },
      data: { bettingLocked: true },
    });
    if (count > 0) logger.info(`Auto-close: ${count} jogo(s) com apostas fechadas automaticamente.`);
  } catch (err) {
    logger.safeError('Scheduler: erro no fechamento automático de apostas', err);
  }
}
setInterval(checkBettingCutoff, 60_000);
checkBettingCutoff();

// ─── Polling automático de pagamentos pendentes ───────────────────────────────
// Roda a cada 3 min e consulta o MP para pagamentos que ainda não foram
// confirmados via webhook (webhook pode falhar ou demorar).
async function checkPendingPayments() {
  try {
    const { prisma } = require('./src/services/prismaClient');
    const { getPaymentStatus } = require('./src/services/mercadoPagoService');
    const { processPaymentUpdate } = require('./src/services/paymentService');

    // Aguarda 5 min após criação antes de consultar (dar tempo para webhook chegar)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    // Não consulta pagamentos mais antigos que 2h (PIX expira em 30min, mas
    // o MP pode demorar para atualizar o status; 2h é margem conservadora)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const pendingPayments = await prisma.payment.findMany({
      where: {
        status: 'pending',
        mpPaymentId: { not: null },
        createdAt: { lt: fiveMinutesAgo, gt: twoHoursAgo },
      },
      include: {
        ticket: { select: { id: true, gameId: true, userId: true, status: true } },
      },
      take: 10, // processa até 10 por ciclo para não sobrecarregar a API do MP
    });

    if (pendingPayments.length === 0) return;

    logger.info(`Auto-payment: verificando ${pendingPayments.length} pagamento(s) pendente(s)`);

    for (const payment of pendingPayments) {
      try {
        const mpStatus = await getPaymentStatus(payment.mpPaymentId);
        await processPaymentUpdate(payment, mpStatus);
      } catch (err) {
        logger.safeError(`Auto-payment: erro ao verificar pagamento ${payment.id}`, err);
      }
    }
  } catch (err) {
    logger.safeError('Scheduler: erro no polling de pagamentos', err);
  }
}
setInterval(checkPendingPayments, 3 * 60 * 1000); // a cada 3 minutos

// ─── Auto-sync de resultados da Mega Sena ────────────────────────────────────
// Roda a cada 30 min. Nas quartas e sábados após 21h BRT (23h UTC),
// busca o resultado oficial e registra automaticamente no jogo ativo.
// Se encontrar ganhador, distribui os prêmios automaticamente.
async function autoSyncMegaSena() {
  try {
    // BRT = UTC-3 (sem horário de verão desde 2019)
    const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const dayBRT = nowBRT.getUTCDay();    // 0=Dom,1=Seg,...,3=Qua,...,6=Sáb
    const hourBRT = nowBRT.getUTCHours();

    // Sorteios apenas em quartas (3) e sábados (6), após 21h BRT
    if (![3, 6].includes(dayBRT) || hourBRT < 21) return;

    const { prisma } = require('./src/services/prismaClient');
    const megaSenaService = require('./src/services/megaSenaService');
    const { processDraw } = require('./src/services/gameService');
    const { distributePrizes } = require('./src/services/prizeService');

    const game = await prisma.game.findFirst({ where: { status: 'active' } });
    if (!game) return;

    const official = await megaSenaService.fetchLatestResult();

    // Verifica se este sorteio já foi registrado (deduplicação por data)
    const drawDateStart = new Date(official.drawDate);
    drawDateStart.setHours(0, 0, 0, 0);
    const drawDateEnd = new Date(official.drawDate);
    drawDateEnd.setHours(23, 59, 59, 999);

    const alreadyRegistered = await prisma.draw.findFirst({
      where: {
        gameId: game.id,
        drawDate: { gte: drawDateStart, lte: drawDateEnd },
      },
    });

    if (alreadyRegistered) return;

    const result = await processDraw(game.id, official.numbers, official.drawDate);

    logger.info('Auto-sync: sorteio Mega Sena registrado automaticamente', {
      contestNumber: official.contestNumber,
      gameId: game.id,
      numbers: official.numbers,
      winners: result.winners.length,
    });

    // Se houver ganhador, distribui prêmios automaticamente
    if (result.winners.length > 0) {
      try {
        await distributePrizes(game.id);
        logger.info('Auto-sync: prêmios distribuídos automaticamente', { gameId: game.id });
      } catch (prizeErr) {
        logger.safeError('Auto-sync: erro na distribuição automática de prêmios', prizeErr);
      }
    }
  } catch (err) {
    logger.safeError('Scheduler: erro no auto-sync Mega Sena', err);
  }
}
setInterval(autoSyncMegaSena, 30 * 60 * 1000); // a cada 30 minutos

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
