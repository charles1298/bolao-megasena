/**
 * Gera CSV seguro sem dependências externas.
 * Escapa campos que contenham vírgulas, aspas ou quebras de linha.
 */
function escapeField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(headers, rows) {
  const header = headers.map(escapeField).join(',');
  const body = rows
    .map((row) => headers.map((h) => escapeField(row[h])).join(','))
    .join('\n');
  return `${header}\n${body}`;
}

function ticketsToCSV(tickets) {
  const headers = [
    'id',
    'usuario',
    'whatsapp',
    'numeros',
    'total_acertos',
    'pe_quente',
    'pe_frio',
    'status',
    'premio',
    'pagamento_status',
    'criado_em',
  ];

  const rows = tickets.map((t) => ({
    id: t.id,
    usuario: t.user?.nickname || '',
    whatsapp: t.user?.whatsapp || '',
    numeros: t.numbers.join('-'),
    total_acertos: t.totalHits,
    pe_quente: t.isPeQuente ? 'Sim' : 'Não',
    pe_frio: t.isPeFrio ? 'Sim' : 'Não',
    status: t.status,
    premio: t.prizeAmount ? `R$ ${Number(t.prizeAmount).toFixed(2)}` : '',
    pagamento_status: t.payment?.status || '',
    criado_em: new Date(t.createdAt).toLocaleString('pt-BR'),
  }));

  return toCSV(headers, rows);
}

function transactionsToCSV(payments) {
  const headers = [
    'id',
    'ticket_id',
    'usuario',
    'mp_payment_id',
    'valor',
    'status',
    'criado_em',
    'pago_em',
  ];

  const rows = payments.map((p) => ({
    id: p.id,
    ticket_id: p.ticketId,
    usuario: p.ticket?.user?.nickname || '',
    mp_payment_id: p.mpPaymentId || '',
    valor: `R$ ${Number(p.amount).toFixed(2)}`,
    status: p.status,
    criado_em: new Date(p.createdAt).toLocaleString('pt-BR'),
    pago_em: p.paidAt ? new Date(p.paidAt).toLocaleString('pt-BR') : '',
  }));

  return toCSV(headers, rows);
}

module.exports = { toCSV, ticketsToCSV, transactionsToCSV };
