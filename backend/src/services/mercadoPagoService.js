const { MercadoPagoConfig, Payment } = require('mercadopago');
const crypto = require('crypto');
const logger = require('../utils/logger');

let mpClient = null;
let paymentClient = null;

function getClient() {
  if (!mpClient) {
    if (!process.env.MP_ACCESS_TOKEN) {
      throw new Error('MP_ACCESS_TOKEN não configurado.');
    }
    mpClient = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN,
      options: { timeout: 10000, idempotencyKey: undefined },
    });
    paymentClient = new Payment(mpClient);
  }
  return paymentClient;
}

/**
 * Cria um pagamento PIX dinâmico no Mercado Pago.
 * @param {object} params
 * @param {string} params.ticketId
 * @param {string} params.payerNickname
 * @param {number} params.amount - Valor em reais (ex: 30.00)
 * @param {string} params.idempotencyKey - UUID único por tentativa de pagamento
 */
async function createPixPayment({ ticketId, payerNickname, amount, idempotencyKey }) {
  const client = getClient();

  const body = {
    transaction_amount: Number(amount),
    description: `Bolão Mega Sena — Cartela ${ticketId.slice(-8).toUpperCase()}`,
    payment_method_id: 'pix',
    payer: {
      email: `${payerNickname.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jogador'}@bolao.com.br`,
      first_name: payerNickname,
    },
    notification_url: `${process.env.BACKEND_URL || 'https://api.seudominio.com.br'}/api/payments/webhook`,
    external_reference: ticketId,
    date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
  };

  const response = await client.create({
    body,
    requestOptions: { idempotencyKey },
  });

  if (!response.point_of_interaction?.transaction_data) {
    throw new Error('Resposta inválida do Mercado Pago — sem dados de transação PIX.');
  }

  const txData = response.point_of_interaction.transaction_data;

  return {
    mpPaymentId: String(response.id),
    qrCode: txData.qr_code,
    qrCodeBase64: txData.qr_code_base64,
    pixCode: txData.qr_code, // Código copia e cola
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    status: response.status,
  };
}

/**
 * Busca o status atual de um pagamento no MP.
 * Usado como fallback caso o webhook não chegue.
 * Retorna também o valor efetivamente transacionado para conferência anti-fraude.
 */
async function getPaymentStatus(mpPaymentId) {
  const client = getClient();
  const response = await client.get({ id: mpPaymentId });
  return {
    status: response.status,
    statusDetail: response.status_detail,
    amount: response.transaction_amount != null ? Number(response.transaction_amount) : null,
    paidAt: response.date_approved ? new Date(response.date_approved) : null,
  };
}

/**
 * Valida a assinatura do webhook do Mercado Pago.
 * Documentação: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
function validateWebhookSignature(req) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    // Sem secret configurado, rejeita para não permitir aprovação falsa de pagamentos.
    // Configure MP_WEBHOOK_SECRET no .env para habilitar o recebimento de webhooks.
    logger.error('MP_WEBHOOK_SECRET não configurado — webhook REJEITADO por segurança.');
    return false;
  }

  const xSignature = req.headers['x-signature'];
  const xRequestId = req.headers['x-request-id'];

  if (!xSignature || !xRequestId) return false;

  // Extrai ts e v1 do header x-signature
  const parts = xSignature.split(',');
  let ts = null;
  let v1 = null;
  for (const part of parts) {
    const [key, value] = part.trim().split('=');
    if (key === 'ts') ts = value;
    if (key === 'v1') v1 = value;
  }

  if (!ts || !v1) return false;

  // Rejeita webhooks com timestamp mais antigo que 5 minutos (replay attack)
  const ageSeconds = (Date.now() / 1000) - Number(ts);
  if (ageSeconds > 300 || ageSeconds < -60) {
    logger.warn('Webhook MP rejeitado: timestamp fora do intervalo', { ts, ageSeconds: Math.round(ageSeconds) });
    return false;
  }

  const dataId = req.query['data.id'] || req.body?.data?.id;
  if (!dataId) {
    logger.warn('Webhook MP rejeitado: dataId ausente no manifest');
    return false;
  }

  // v1 deve ser hash SHA-256 em hex (64 chars). Rejeita formato inválido ANTES
  // do timingSafeEqual — buffers de tamanhos diferentes fariam o compare lançar
  // exceção (que viraria 200 no handler, mascarando a rejeição).
  if (typeof v1 !== 'string' || !/^[a-f0-9]{64}$/i.test(v1)) {
    logger.warn('Webhook MP rejeitado: formato de assinatura inválido');
    return false;
  }

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  const v1Buf = Buffer.from(v1, 'hex');
  const expectedBuf = Buffer.from(expectedHash, 'hex');
  if (v1Buf.length !== expectedBuf.length) return false;

  return crypto.timingSafeEqual(v1Buf, expectedBuf);
}

module.exports = { createPixPayment, getPaymentStatus, validateWebhookSignature };
