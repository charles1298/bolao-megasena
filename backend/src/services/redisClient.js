const { createClient } = require('redis');
const logger = require('../utils/logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

const redisClient = createClient({
  url: REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) return new Error('Redis: número máximo de reconexões atingido');
      return Math.min(retries * 200, 3000);
    },
  },
});

redisClient.on('error', (err) => {
  logger.warn('Redis: erro de conexão', { message: err.message });
});

redisClient.on('connect', () => {
  logger.info('Redis: conectado');
});

redisClient.on('reconnecting', () => {
  logger.info('Redis: reconectando...');
});

// Conexão assíncrona — não bloqueia inicialização do servidor
redisClient.connect().catch((err) => {
  logger.error('Redis: falha na conexão inicial', { message: err.message });
});

module.exports = redisClient;
