import React from 'react';

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

const STATUS_MAP = {
  pending_payment: { label: 'Aguardando pagamento', cls: 'badge-warning' },
  active:          { label: '✅ Paga',              cls: 'badge-success'  },
  winner:          { label: '🏆 Ganhadora!',        cls: 'badge-gold'     },
};

// Remoção de cartela é exclusiva do admin (via /admin/tickets/:id no painel).
// Usuários comuns não têm controle sobre cancelamento — para evitar fraudes,
// disputas pós-sorteio e divergências contábeis com pagamentos já aprovados.
export default function TicketCard({ ticket }) {
  const status   = STATUS_MAP[ticket.status] ?? { label: ticket.status, cls: 'badge-muted' };
  const hitNums  = getHitNumbers(ticket);
  const isWinner = ticket.status === 'winner';

  return (
    <div
      className={`card fade-in ${isWinner ? 'card-gold' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        ...(isWinner ? { animation: 'winnerPulse 2s ease infinite' } : {}),
      }}
    >
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: '0.63rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Protocolo</div>
          <span style={{
            fontFamily: 'monospace', fontSize: '0.82rem', letterSpacing: 1,
            color: isWinner ? 'var(--gold2)' : 'var(--text-muted)',
            fontWeight: isWinner ? 700 : 400,
          }}>
            #{ticket.id.slice(-8).toUpperCase()}
          </span>
          {ticket.createdAt && (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 3 }}>
              Comprado em {formatDate(ticket.createdAt)}
            </div>
          )}
        </div>
        <span className={`badge ${status.cls}`}>{status.label}</span>
      </div>

      {/* Bolas */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {ticket.numbers.map((n) => {
          const hit = hitNums.includes(n);
          return (
            <span
              key={n}
              className={`number-ball ${hit ? 'number-ball-hit' : 'number-ball-default'}`}
              style={{ width: 36, height: 36, fontSize: '0.78rem', cursor: 'default' }}
            >
              {String(n).padStart(2, '0')}
            </span>
          );
        })}
      </div>

      {/* Rodapé */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ marginRight: 'auto' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Acertos acumulados</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--gold2)', fontFamily: "'Cormorant Garamond', serif" }}>
            {ticket.totalHits}/8
          </div>
        </div>

        {ticket.prizeAmount && Number(ticket.prizeAmount) > 0 && (
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            🏅 Prêmio:{' '}
            <strong style={{ color: 'var(--gold2)' }}>
              R$ {Number(ticket.prizeAmount).toFixed(2).replace('.', ',')}
            </strong>
          </div>
        )}
      </div>

      {/* Confirmação de pagamento */}
      {ticket.status === 'active' && ticket.payment?.paidAt && (
        <div style={{ fontSize: '0.76rem', color: 'var(--forest3)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>✓</span>
          <span>Pagamento confirmado em {formatDate(ticket.payment.paidAt)}</span>
        </div>
      )}

      {/* Mensagem para ganhador */}
      {isWinner && (
        <div style={{
          padding: '12px 14px',
          background: 'rgba(212,168,67,.1)',
          border: '1px solid rgba(212,168,67,.3)',
          borderRadius: 10,
          fontSize: '0.82rem',
          color: 'var(--gold2)',
          textAlign: 'center',
          lineHeight: 1.6,
        }}>
          🎉 <strong>Parabéns!</strong> O administrador entrará em contato pelo WhatsApp para a entrega do prêmio.
          <br />
          <span style={{ fontSize: '0.78rem', opacity: 0.8 }}>
            Protocolo: <strong>#{ticket.id.slice(-8).toUpperCase()}</strong>
          </span>
        </div>
      )}

      {/* Aviso de pagamento pendente */}
      {ticket.status === 'pending_payment' && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(212,168,67,.08)',
          border: '1px solid rgba(212,168,67,.25)',
          borderRadius: 10,
          fontSize: '0.8rem',
          color: 'var(--gold2)',
        }}>
          ⏳ Pagamento pendente — conclua o PIX para ativar.
        </div>
      )}

    </div>
  );
}

function getHitNumbers(ticket) {
  if (!Array.isArray(ticket.hitHistory)) return [];
  const allDrawn = ticket.hitHistory.flatMap((h) => h.drawnNumbers ?? []);
  return ticket.numbers.filter((n) => allDrawn.includes(n));
}
