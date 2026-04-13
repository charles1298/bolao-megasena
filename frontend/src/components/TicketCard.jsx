import React from 'react';

const STATUS_MAP = {
  pending_payment: { label: 'Aguardando pagamento', cls: 'badge-warning' },
  active:          { label: 'Ativa',                cls: 'badge-success'  },
  winner:          { label: '🏆 Ganhadora!',        cls: 'badge-gold'     },
};

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)', letterSpacing: 1 }}>
          #{ticket.id.slice(-8).toUpperCase()}
        </span>
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
            {ticket.totalHits}/6
          </div>
        </div>

        {ticket.isPeQuente && (
          <span className="badge badge-warning" title="5 acertos acumulados">🔥 Pé Quente</span>
        )}
        {ticket.isPeFrio && (
          <span className="badge badge-muted" title="0 acertos no último sorteio">❄️ Pé Frio</span>
        )}

        {ticket.prizeAmount && Number(ticket.prizeAmount) > 0 && (
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            🏅 Prêmio:{' '}
            <strong style={{ color: 'var(--gold2)' }}>
              R$ {Number(ticket.prizeAmount).toFixed(2).replace('.', ',')}
            </strong>
          </div>
        )}
      </div>

      {/* Aviso de pagamento pendente */}
      {ticket.payment?.status === 'pending' && (
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
