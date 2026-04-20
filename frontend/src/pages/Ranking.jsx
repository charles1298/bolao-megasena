import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function Ranking() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/game/ranking')
      .then(({ data }) => setData(data))
      .catch(() => setError('Não foi possível carregar o ranking.'))
      .finally(() => setLoading(false));
  }, []);

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

  const { ranking, game } = data;
  const draws = (game.draws || []).slice().sort((a, b) => b.drawOrder - a.drawOrder);

  return (
    <div className="container" style={{ padding: '40px 20px', maxWidth: 960 }}>

      {/* ── Seção superior: Sorteios da Mega Sena ── */}
      <div style={{ marginBottom: 40 }}>
        <h2 className="section-title">Sorteios <span>Realizados</span></h2>

        {draws.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)' }}>
            Nenhum sorteio realizado ainda.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {draws.map((draw) => (
              <div key={draw.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', padding: '16px 20px' }}>
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

      {/* ── Seção inferior: Desempenho dos jogadores ── */}
      <div>
        <h2 className="section-title">Desempenho dos <span>Jogadores</span></h2>

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
                    <th style={{ textAlign: 'center' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((row) => (
                    <tr
                      key={`${row.nickname}-${(row.numbers || []).join('-')}`}
                      style={row.status === 'winner' ? { background: 'rgba(212,168,67,.08)' } : undefined}
                    >
                      <td><PositionBadge pos={row.position} /></td>
                      <td style={{ fontWeight: 600 }}>{row.nickname}</td>
                      <td>
                        <NumberRow numbers={row.numbers || []} accumulated={game.accumulatedNumbers} />
                      </td>
                      {draws.slice().reverse().map((draw) => {
                        const entry = (row.hitHistory || []).find((h) => h.drawOrder === draw.drawOrder);
                        const hits = entry ? entry.hitsThisDraw : null;
                        return (
                          <td key={draw.id} style={{ textAlign: 'center' }}>
                            <HitsBadge hits={hits} />
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'center' }}>
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
          <span>🏆 Ganhador (6 acertos acumulados)</span>
          <span>🔥 Pé quente (5 no último sorteio)</span>
          <span>❄️ Pé frio (0 no último sorteio)</span>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function PositionBadge({ pos }) {
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
    hits >= 6 ? 'var(--gold)' :
    hits >= 4 ? '#ff8c00' :
    hits >= 2 ? 'var(--forest3)' :
    'var(--text-muted)';
  return (
    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', fontWeight: 700, color }}>
      {hits}
    </span>
  );
}

function TotalBadge({ hits, status }) {
  if (status === 'winner') return <span className="badge badge-success">🏆 {hits}</span>;
  const color =
    hits >= 6 ? 'var(--gold)' :
    hits >= 4 ? '#ff8c00' :
    hits >= 2 ? 'var(--forest3)' :
    'var(--text-muted)';
  return (
    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 700, color }}>
      {hits}
    </span>
  );
}
