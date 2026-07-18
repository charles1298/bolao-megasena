const { prisma } = require('../services/prismaClient');
const { validateWebhookSignature, getPaymentStatus } = require('../services/mercadoPagoService');
const { processPaymentUpdate } = require('../services/paymentService');
const logger = require('../utils/logger');

/**
 * POST /api/payments/webhook
 * Recebe notificações do Mercado Pago.
 * IMPORTANTE: Este endpoint não requer autenticação JWT (é chamado pelo MP).
 */
async function handleWebhook(req, res) {
  try {
    // Valida assinatura do Mercado Pago
    if (!validateWebhookSignature(req)) {
      logger.warn('Webhook MP com assinatura inválida', { ip: req.ip });
      return res.status(401).json({ error: 'Assinatura inválida.' });
    }

    // express.raw() entrega o body como Buffer — precisa parsear para JSON
    let body;
    try {
      body = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString('utf8')) : req.body;
    } catch {
      return res.status(400).json({ error: 'Body inválido.' });
    }

    const { type, data } = body;

    // MP envia type=payment para notificações de pagamento
    if (type !== 'payment') {
      return res.status(200).json({ received: true });
    }

    const mpPaymentId = String(data?.id);
    if (!mpPaymentId) {
      return res.status(400).json({ error: 'ID de pagamento ausente.' });
    }

    // Busca o payment no nosso banco pelo ID do MP
    const payment = await prisma.payment.findUnique({
      where: { mpPaymentId },
      include: {
        ticket: {
          select: { id: true, gameId: true, userId: true, status: true },
        },
      },
    });

    if (!payment) {
      // Pode ser notificação de outro produto — ignora silenciosamente
      logger.info('Webhook MP: payment não encontrado no banco', { mpPaymentId });
      return res.status(200).json({ received: true });
    }

    // Consulta status atual no MP
    const mpStatus = await getPaymentStatus(mpPaymentId);

    await processPaymentUpdate(payment, mpStatus);

    res.status(200).json({ received: true });
  } catch (err) {
    logger.safeError('Erro no webhook MP', err);
    // MP reenviará se retornar 5xx — retornamos 200 para evitar reenvio em caso de erro nosso
    res.status(200).json({ received: true, error: 'Processamento com erros — verificar logs.' });
  }
}

/**
 * POST /api/payments/check/:paymentId
 * Polling manual: usuário pode checar se pagamento foi confirmado.
 */
async function checkPaymentStatus(req, res) {
  try {
    const { paymentId } = req.params;

    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        ticket: { userId: req.user.id },
      },
      include: { ticket: { select: { id: true, gameId: true, userId: true, status: true } } },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Pagamento não encontrado.' });
    }

    // Se já aprovado, retorna direto
    if (payment.status === 'approved') {
      return res.json({ status: 'approved', ticketStatus: payment.ticket.status });
    }

    // Consulta MP se tiver ID
    if (payment.mpPaymentId) {
      try {
        const mpStatus = await getPaymentStatus(payment.mpPaymentId);
        await processPaymentUpdate(payment, mpStatus);

        const updated = await prisma.payment.findUnique({ where: { id: paymentId } });
        return res.json({
          status: updated.status,
          ticketStatus: payment.ticket.status,
        });
      } catch (mpErr) {
        logger.safeError('Erro ao consultar MP no check', mpErr);
      }
    }

    res.json({ status: payment.status, ticketStatus: payment.ticket.status });
  } catch (err) {
    logger.safeError('Erro ao checar pagamento', err);
    res.status(500).json({ error: 'Erro ao verificar pagamento.' });
  }
}

module.exports = { handleWebhook, checkPaymentStatus };
