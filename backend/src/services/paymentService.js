'use strict';
const { prisma } = require('./prismaClient');
const logger = require('../utils/logger');

// Tolerância de centavos para comparar valor pago x esperado (evita ruído de float)
const AMOUNT_EPSILON = 0.001;

/**
 * Normaliza o status cru do Mercado Pago para o enum PaymentStatus do banco.
 * O MP usa mais estados do que o nosso enum — todos precisam ser mapeados,
 * senão o prisma.update lança erro de enum e o status nunca atualiza.
 */
function normalizeMpStatus(mpStatus) {
  switch (mpStatus) {
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'cancelled':
    case 'refunded':
    case 'charged_back':
      return 'cancelled'; // terminal negativo (inclui estorno/chargeback)
    case 'pending':
    case 'in_process':
    case 'in_mediation':
    case 'authorized':
    default:
      return 'pending';
  }
}

/**
 * Processa atualização de status de um pagamento MP.
 * Compartilhado entre webhook, polling automático e check manual.
 *
 * Garantias:
 * - Verifica o valor pago no MP contra o valor esperado antes de aprovar.
 * - Ativa cartela + incrementa pot de forma idempotente (proteção contra
 *   concorrência entre webhook/polling/check rodando ao mesmo tempo).
 * - Trata estorno/chargeback (refunded/charged_back): reverte a cartela e
 *   decrementa o pot. Cartela já ganhadora exige intervenção manual.
 *
 * @param {object} payment - Registro do banco, deve incluir ticket { id, gameId, userId, status }
 * @param {object} mpStatus - { status, statusDetail, amount, paidAt }
 */
async function processPaymentUpdate(payment, mpStatus) {
  const newStatus = normalizeMpStatus(mpStatus.status);
  if (newStatus === payment.status) return;

  const wasApproved = payment.status === 'approved';

  // ─── APROVAÇÃO ──────────────────────────────────────────────────────────
  if (newStatus === 'approved') {
    // Conferência de valor: só aprova se o MP confirmar o valor E ele bater com
    // o esperado. Se o valor vier ausente/nulo, NÃO aprova (não dá pra conferir
    // anti-fraude às cegas) — o polling reprocessa quando o MP retornar o valor.
    const expected = Number(payment.amount);
    const paid = mpStatus.amount != null ? Number(mpStatus.amount) : null;
    if (paid == null || Math.abs(paid - expected) > AMOUNT_EPSILON) {
      logger.error('Pagamento sem valor confirmável ou divergente — aprovação RECUSADA', {
        paymentId: payment.id,
        mpPaymentId: payment.mpPaymentId,
        expected: expected.toFixed(2),
        paid: paid == null ? 'null' : paid.toFixed(2),
      });
      return; // não aprova nem ativa a cartela
    }

    await prisma.$transaction(async (tx) => {
      // Idempotência: só prossegue se ainda NÃO estava aprovado
      const upd = await tx.payment.updateMany({
        where: { id: payment.id, status: { not: 'approved' } },
        data: { status: 'approved', paidAt: mpStatus.paidAt || new Date() },
      });
      if (upd.count === 0) return; // outro processo já aprovou — não duplica pot

      if (payment.ticket.status === 'pending_payment') {
        await tx.ticket.update({
          where: { id: payment.ticket.id },
          data: { status: 'active' },
        });
        await tx.game.update({
          where: { id: payment.ticket.gameId },
          data: { totalPot: { increment: Number(payment.amount) } },
        });
      }
    });

    logger.info('Pagamento aprovado — cartela ativada', {
      paymentId: payment.id,
      ticketId: payment.ticket.id,
      mpPaymentId: payment.mpPaymentId,
    });
    return;
  }

  // ─── ESTORNO / CHARGEBACK / CANCELAMENTO de pagamento já aprovado ────────
  if (wasApproved && (newStatus === 'cancelled' || newStatus === 'rejected')) {
    // Cartela ganhadora não é revertida automaticamente — alerta para ação manual
    if (payment.ticket.status === 'winner') {
      logger.error('ALERTA: estorno/chargeback em cartela GANHADORA — intervenção manual necessária', {
        paymentId: payment.id,
        ticketId: payment.ticket.id,
        mpPaymentId: payment.mpPaymentId,
        mpStatus: mpStatus.status,
      });
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: newStatus },
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const upd = await tx.payment.updateMany({
        where: { id: payment.id, status: 'approved' },
        data: { status: newStatus, paidAt: null },
      });
      if (upd.count === 0) return; // já revertido por outro processo

      if (payment.ticket.status === 'active') {
        await tx.ticket.update({
          where: { id: payment.ticket.id },
          data: { status: 'pending_payment' },
        });
        await tx.game.update({
          where: { id: payment.ticket.gameId },
          data: { totalPot: { decrement: Number(payment.amount) } },
        });
      }
    });

    logger.warn('Pagamento estornado/cancelado — cartela revertida e pot ajustado', {
      paymentId: payment.id,
      ticketId: payment.ticket.id,
      mpPaymentId: payment.mpPaymentId,
      mpStatus: mpStatus.status,
    });
    return;
  }

  // ─── Transições sem efeito financeiro (ex.: pending → rejected/cancelled) ─
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: newStatus, paidAt: null },
  });
}

module.exports = { processPaymentUpdate, normalizeMpStatus };
