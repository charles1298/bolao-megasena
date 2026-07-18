import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const POLL_INTERVAL = 30_000;
const WIN_TARGET = 8;

export default function Ranking() {
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadData = useCallback(() => {
    return api.get('/game/ranking')
      .then(({ data }) => { setData(data); setLastUpdated(new Date()); setError(null); })
      .catch(() => setError('Não foi possível carregar o ranking.'));
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
    const poll = setInterval(loadData, POLL_INTERVAL);
    return () => clearInterval(poll);
  }, [loadData]);

  if (loading) {
    return (
      <div className="loading-overlay" style={{ minHeight: '60vh' }}>
        <div className="spinner" style={{ width: 44, height: 44 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>{error}</p>
      </div>
    );
  }

  if (!data?.game) {
    return (
      <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🏆</div>
        <h3 style={{ color: 'var(--gold)', marginBottom: 8 }}>Nenhum jogo em andamento</h3>
        <p style={{ color: 'var(--text-muted)' }}>O ranking estará disponível quando um jogo estiver ativo.</p>
      </div>
    );
  }

  const { ranking, game, champions = [] } = data;
  const draws   = (game.draws || []).slice().sort((a, b) => b.drawOrder - a.drawOrder);
  const winners = ranking.filter((r) => r.status === 'winner');
  const leader  = ranking[0];

  return (
    <div className="container page-enter" style={{ padding: '40px 20px', maxWidth: 1040 }}>

      {/* ── Banner Fim de Jogo ── */}
      {game.status === 'finished' && winners.length > 0 && (
        <div className="card fade-in" style={{
          borderColor: 'var(--gold)',
          background: 'rgba(212,168,67,.07)',
          textAlign: 'center',
          padding: '36px 24px',
          marginBottom: 32,
          animation: 'winnerPulse 2s ease infinite',
        }}>
          <div style={{ fontSize: '3.5rem', marginBottom: 10 }}>🏆</div>
          <h2 style={{ color: 'var(--gold2)', marginBottom: 12, fontFamily: "'Cormorant Garamond', serif" }}>
            Fim de Jogo!
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {winners.map((w) => (
              <div key={`${w.nickname}-${(w.numbers || []).join('')}`} style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--cream)' }}>
                🥇 {w.nickname} — {w.totalHits} acertos acumulados
              </div>
            ))}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            O bolão encerrou. O ganhador será contatado pelo administrador. Um novo jogo será aberto em breve!
          </p>
        </div>
      )}

      {/* ── Sorteios realizados ── */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Sorteios <span>Realizados</span></h2>
          {lastUpdated && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--forest3)', display: 'inline-block', animation: 'livePulse 2s ease infinite' }} />
              Atualiza a cada 30s · {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>

        {draws.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)' }}>
            Nenhum sorteio realizado ainda.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {draws.map((draw, i) => (
              <div key={draw.id} className="card" style={{
                display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
                padding: '16px 20px', animation: `revealUp .4s ease ${i * 60}ms both`,
              }}>
                <div style={{ minWidth: 80 }}>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 2 }}>
                    Sorteio #{draw.drawOrder}
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--cream)' }}>
                    {formatDate(draw.drawDate)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[...draw.numbers].sort((a, b) => a - b).map((n) => (
                    <span key={n} className="drawn-ball" style={{ width: 36, height: 36, fontSize: '0.8rem' }}>
                      {String(n).padStart(2, '0')}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Ranking de jogadores ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Desempenho dos <span>Jogadores</span></h2>
          {leader && game.status !== 'finished' && (
            <div style={{
              background: 'rgba(212,168,67,.08)', border: '1px solid rgba(212,168,67,.25)',
              borderRadius: 12, padding: '8px 14px', fontSize: '0.82rem',
            }}>
              <span style={{ color: 'var(--text-muted)' }}>Líder: </span>
              <strong style={{ color: 'var(--gold2)' }}>{leader.nickname}</strong>
              <span style={{ color: 'var(--text-muted)' }}> — faltam </span>
              <strong style={{ color: 'var(--gold)' }}>{Math.max(0, WIN_TARGET - leader.totalHits)}</strong>
              <span style={{ color: 'var(--text-muted)' }}> acertos para vencer</span>
            </div>
          )}
        </div>

        {ranking.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎯</div>
            <p style={{ color: 'var(--text-muted)' }}>Nenhuma aposta ativa no momento.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 48 }}>#</th>
                    <th>Apostador</th>
                    <th>Números</th>
                    {draws.slice().reverse().map((draw) => (
                      <th key={draw.id} style={{ textAlign: 'center', minWidth: 64 }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Sorteio</div>
                        <div>#{draw.drawOrder}</div>
                      </th>
                    ))}
                    <th style={{ textAlign: 'center', minWidth: 100 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((row) => (
                    <tr
                      key={`${row.nickname}-${(row.numbers || []).join('-')}`}
                      style={row.status === 'winner' ? { background: 'rgba(212,168,67,.08)' } : undefined}
                    >
                      <td><PositionBadge pos={row.position} status={row.status} /></td>
                      <td style={{ fontWeight: 600 }}>{row.nickname}</td>
                      <td>
                        <NumberRow numbers={row.numbers || []} accumulated={game.accumulatedNumbers} />
                      </td>
                      {draws.slice().reverse().map((draw) => {
                        const entry = (row.hitHistory || []).find((h) => h.drawOrder === draw.drawOrder);
                        const hits  = entry ? entry.hitsThisDraw : null;
                        return (
                          <td key={draw.id} style={{ textAlign: 'center' }}>
                            <HitsBadge hits={hits} />
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'center', padding: '10px 16px' }}>
                        <TotalBadge hits={row.totalHits} status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <span><span style={{ color: 'var(--gold)' }}>■</span> Número acumulado</span>
          <span>🏆 Ganhador (acertou os 8 números)</span>
        </div>
      </div>

      {/* ── Campeões anteriores ── */}
      {champions.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h2 className="section-title" style={{ marginBottom: 20 }}>Campeões <span>Anteriores</span></h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {champions.map((c, i) => (
              <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '14px 18px' }}>
                <span style={{ fontSize: '1.5rem' }}>🏆</span>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontWeight: 700, color: 'var(--gold2)' }}>{c.nickname}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {c.gameName} · {formatDate(c.date)}
                  </div>
                </div>
                {c.prizeAmount != null && (
                  <div style={{ fontSize: '0.9rem', color: 'var(--forest3)', fontWeight: 600 }}>
                    R$ {c.prizeAmount.toFixed(2).replace('.', ',')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function PositionBadge({ pos, status }) {
  if (status === 'winner') return <span style={{ fontSize: '1.3rem' }}>🏆</span>;
  const medals = ['🥇', '🥈', '🥉'];
  if (pos <= 3) return <span style={{ fontSize: '1.3rem' }}>{medals[pos - 1]}</span>;
  return <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{pos}º</span>;
}

function NumberRow({ numbers, accumulated }) {
  const accSet = new Set(accumulated || []);
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {numbers.map((n) => (
        <span
          key={n}
          className={accSet.has(n) ? 'number-ball number-ball-hit' : 'number-ball number-ball-default'}
          style={{ width: 28, height: 28, fontSize: '0.72rem' }}
        >
          {String(n).padStart(2, '0')}
        </span>
      ))}
    </div>
  );
}

function HitsBadge({ hits }) {
  if (hits === null || hits === undefined) {
    return <span style={{ color: 'rgba(255,255,255,.2)', fontSize: '0.8rem' }}>—</span>;
  }
  const color =
    hits >= 6 ? 'var(--gold)'    :
    hits >= 4 ? '#ff8c00'        :
    hits >= 2 ? 'var(--forest3)' :
    'var(--text-muted)';
  return (
    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', fontWeight: 700, color }}>
      {hits}
    </span>
  );
}

function TotalBadge({ hits, status }) {
  if (status === 'winner') {
    return (
      <div style={{ textAlign: 'center' }}>
        <span className="badge badge-success" style={{ fontSize: '0.9rem' }}>🏆 {hits}</span>
        <div style={{ fontSize: '0.65rem', color: 'var(--forest3)', marginTop: 3 }}>Ganhador!</div>
      </div>
    );
  }

  const remaining = Math.max(0, WIN_TARGET - hits);
  const pct       = Math.round((hits / WIN_TARGET) * 100);
  const color =
    hits >= 7 ? 'var(--gold)'    :
    hits >= 5 ? '#ff8c00'        :
    hits >= 3 ? 'var(--forest3)' :
    'var(--text-muted)';

  return (
    <div style={{ minWidth: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 5 }}>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 700, color, lineHeight: 1 }}>
          {hits}
        </span>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', paddingBottom: 2, whiteSpace: 'nowrap' }}>
          {remaining > 0 ? `faltam ${remaining}` : ''}
        </span>
      </div>
      {/* Barra de progresso rumo a 8 acertos */}
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: color, borderRadius: 2,
          transition: 'width .5s ease',
        }} />
      </div>
    </div>
  );
}
