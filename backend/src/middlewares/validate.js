const { validationResult } = require('express-validator');
const xss = require('xss');

/**
 * Processa resultados do express-validator.
 * Retorna 422 com lista de erros se houver falhas.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error: 'Dados inválidos.',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

/**
 * Sanitiza string contra XSS.
 */
function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  return xss(value.trim());
}

/**
 * Middleware que sanitiza todos os campos string de req.body recursivamente.
 */
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeRecursive(req.body);
  }
  next();
}

function sanitizeRecursive(obj) {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeRecursive);
  }
  if (obj !== null && typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeRecursive(value);
    }
    return result;
  }
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  return obj;
}

module.exports = { validate, sanitizeBody, sanitizeString };
