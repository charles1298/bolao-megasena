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

  return (
    <div className="container" style={{ padding: '40px 20px', maxWidth: 900 }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 32 }}>
        <h2 className="section-title">
          Ranking de <span>Acertos</span>
        </h2>
        <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
          {game.name} · {game.drawCount} sorteio{game.drawCount !== 1 ? 's' : ''} realizados
        </p>
      </div>

      {/* Números acumulados */}
      {game.accumulatedNumbers?.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Números acumulados até agora
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[...game.accumulatedNumbers].sort((a, b) => a - b).map((n) => (
              <div key={n} className="drawn-ball" style={{ width: 38, height: 38, fontSize: '0.85rem' }}>
                {String(n).padStart(2, '0')}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sem apostadores ainda */}
      {ranking.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎯</div>
          <p style={{ color: 'var(--text-muted)' }}>Nenhuma aposta ativa no momento.</p>
        </div>
      )}

      {/* Tabela de ranking */}
      {ranking.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 56 }}>#</th>
                  <th>Apostador</th>
                  <th>Números</th>
                  <th style={{ textAlign: 'center' }}>Acertos</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row) => (
                  <tr
                    key={`${row.nickname}-${row.numbers.join('-')}`}
                    style={row.status === 'winner' ? { background: 'rgba(212,168,67,.08)' } : undefined}
                  >
                    {/* Posição */}
                    <td>
                      <PositionBadge pos={row.position} />
                    </td>

                    {/* Nickname */}
                    <td style={{ fontWeight: 600 }}>{row.nickname}</td>

                    {/* Números com destaque nos acertados */}
                    <td>
                      <NumberRow
                        numbers={row.numbers}
                        accumulated={game.accumulatedNumbers}
                      />
                    </td>

                    {/* Acertos */}
                    <td style={{ textAlign: 'center' }}>
                      <HitsBadge hits={row.totalHits} />
                    </td>

                    {/* Status */}
                    <td style={{ textAlign: 'center' }}>
                      <StatusBadge row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legenda */}
      <div style={{ marginTop: 20, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        <span><span style={{ color: 'var(--gold)' }}>■</span> Número acertado</span>
        <span>🏆 Ganhador (6 acertos)</span>
        <span>🔥 Pé quente (5 acertos)</span>
        <span>❄️ Pé frio (0 acertos no último sorteio)</span>
      </div>
    </div>
  );
}

function PositionBadge({ pos }) {
  const medals = ['🥇', '🥈', '🥉'];
  if (pos <= 3) {
    return (
      <span style={{ fontSize: '1.3rem' }}>{medals[pos - 1]}</span>
    );
  }
  return (
    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{pos}º</span>
  );
}

function NumberRow({ numbers, accumulated }) {
  const accSet = new Set(accumulated || []);
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {numbers.map((n) => {
        const hit = accSet.has(n);
        return (
          <span
            key={n}
            className={hit ? 'number-ball number-ball-hit' : 'number-ball number-ball-default'}
            style={{ width: 28, height: 28, fontSize: '0.72rem' }}
          >
            {String(n).padStart(2, '0')}
          </span>
        );
      })}
    </div>
  );
}

function HitsBadge({ hits }) {
  const color =
    hits >= 6 ? 'var(--gold)' :
    hits >= 5 ? '#ff8c00' :
    hits >= 3 ? 'var(--forest3)' :
    'var(--text-muted)';

  return (
    <span style={{
      fontFamily: "'Cormorant Garamond', serif",
      fontSize: '1.4rem',
      fontWeight: 700,
      color,
    }}>
      {hits}
    </span>
  );
}

function StatusBadge({ row }) {
  if (row.status === 'winner') {
    return <span className="badge badge-success">🏆 Ganhador</span>;
  }
  if (row.isPeQuente) {
    return <span className="badge badge-warning" style={{ background: 'rgba(255,140,0,.15)', color: '#ff8c00', border: '1px solid rgba(255,140,0,.3)' }}>🔥 Pé quente</span>;
  }
  if (row.isPeFrio) {
    return <span className="badge" style={{ background: 'rgba(100,150,255,.12)', color: '#8ab4ff', border: '1px solid rgba(100,150,255,.25)' }}>❄️ Pé frio</span>;
  }
  return <span className="badge">{row.totalHits > 0 ? `${row.totalHits} acerto${row.totalHits > 1 ? 's' : ''}` : 'Em jogo'}</span>;
}
