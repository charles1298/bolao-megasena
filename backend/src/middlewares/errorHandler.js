const logger = require('../utils/logger');

/**
 * Handler centralizado de erros.
 * NUNCA expõe stack trace ou mensagens internas para o cliente em produção.
 */
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  logger.error('Erro não tratado', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user?.id,
  });

  // Em produção, resposta genérica para erros 5xx
  if (process.env.NODE_ENV === 'production' && status >= 500) {
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }

  res.status(status).json({
    error: err.message || 'Erro interno do servidor.',
  });
}

/**
 * Handler para rotas não encontradas.
 */
function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Rota não encontrada.' });
}

module.exports = { errorHandler, notFoundHandler };
