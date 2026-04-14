import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

/* ── Próximo sorteio (Ter/Qui/Sáb) ── */
function getNextDraw() {
  const now   = new Date();
  const days  = [2, 4, 6]; // Ter=2, Qui=4, Sáb=6
  const today = now.getDay();
  let diff = days.map((d) => (d - today + 7) % 7 || 7);
  const minDiff = Math.min(...diff);
  const next  = new Date(now);
  next.setDate(now.getDate() + minDiff);
  next.setHours(20, 0, 0, 0); // ~20h
  return next;
}

function useCountdown(target) {
  const [left, setLeft] = useState(Math.max(0, target - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, target - Date.now())), 1000);
    return () => clearInterval(id);
  }, [target]);
  const d  = Math.floor(left / 86400000);
  const h  = Math.floor((left % 86400000) / 3600000);
  const m  = Math.floor((left % 3600000)  / 60000);
  const s  = Math.floor((left % 60000)    / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return { d: pad(d), h: pad(h), m: pad(m), s: pad(s) };
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [game,       setGame]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [megaSena,   setMegaSena]   = useState(null);
  const [msLoading,  setMsLoading]  = useState(true);

  const drawTarget = getNextDraw().getTime();
  const countdown  = useCountdown(drawTarget);

  useEffect(() => {
    api.get('/game/current')
      .then(({ data }) => setGame(data))
      .catch(() => setGame(null))
      .finally(() => setLoading(false));
  }, []);

  // Busca resultado Mega Sena diretamente da Caixa (IP do browser, não da VPS)
  useEffect(() => {
    function parseCaixaResult(data) {
      if (!data || !data.listaDezenas) return null;
      const numbers = data.listaDezenas.map((n) => parseInt(n, 10)).sort((a, b) => a - b);
      const prizes = (data.listaRateioPremio || []).map((p) => ({
        tier: p.descricaoFaixa,
        winners: p.numeroDeGanhadores,
        prize: Number(p.valorPremio || 0),
      }));
      return {
        contestNumber: data.numero,
        drawDateFormatted: data.dataApuracao,
        numbers,
        accumulated: !!data.acumulado,
        nextPrizeEstimate: Number(data.valorEstimadoProximoConcurso || 0),
        prizes,
      };
    }

    async function fetchMegaSena() {
      setMsLoading(true);
      try {
        // Tenta buscar direto da Caixa (browser tem IP residencial, não bloqueado)
        const res = await fetch(
          'https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena/',
          { headers: { Accept: 'application/json' } }
        );
        if (res.ok) {
          const data = await res.json();
          setMegaSena(parseCaixaResult(data));
        } else {
          // Fallback: tenta pelo backend
          const backendRes = await api.get('/game/mega-sena/latest');
          setMegaSena(backendRes.data);
        }
      } catch {
        // Fallback: tenta pelo backend
        try {
          const backendRes = await api.get('/game/mega-sena/latest');
          setMegaSena(backendRes.data);
        } catch {
          setMegaSena(null);
        }
      } finally {
        setMsLoading(false);
      }
    }

    fetchMegaSena();
    const interval = setInterval(fetchMegaSena, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const prize65 = game
    ? (Number(game.totalPot) * 0.65).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'R$ 0,00';

  return (
    <div className="container" style={{ paddingBottom: '4rem' }}>

      {/* ── Hero ── */}
      <div className="hero-section fade-in">
        <div className="hero-deco"  />
        <div className="hero-deco2" />

        <div className="hero-live-tag">
          <span className="hero-live-dot" />
          Mega Sena Oficial — Ao Vivo
        </div>

        <h1 className="hero-title">
          Jogue pela<br /><em>sua sorte</em>
        </h1>
        <p className="hero-sub">
          Acerte os 6 números e leve o prêmio acumulado do bolão
        </p>

        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Bloco de prêmio + countdown */}
          <div className="prize-block">
            <div className="prize-lbl">Prêmio estimado (6 acertos)</div>
            <div className="prize-val">{loading ? '...' : prize65}</div>
            <div className="prize-note">65% do fundo total arrecadado</div>
            <div className="cd-row">
              <div className="cd-box"><div className="cd-val">{countdown.d}</div><div className="cd-label">Dias</div></div>
              <div className="cd-box"><div className="cd-val">{countdown.h}</div><div className="cd-label">Horas</div></div>
              <div className="cd-box"><div className="cd-val">{countdown.m}</div><div className="cd-label">Min</div></div>
              <div className="cd-box"><div className="cd-val">{countdown.s}</div><div className="cd-label">Seg</div></div>
            </div>
          </div>

          {/* Pills informativas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 200 }}>
            <div className="info-pill">
              Sorteios: <strong>Ter · Qui · Sáb</strong>
            </div>
            <div className="info-pill">
              Cartela: <strong>R$ 30,00</strong>
            </div>
            {game && (
              <>
                <div className="info-pill">
                  Cartelas ativas: <strong>{game.activeTickets ?? '—'}</strong>
                </div>
                <div className="info-pill">
                  Sorteios realizados: <strong>{game.drawCount ?? 0}</strong>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Números acumulados */}
        {game?.accumulatedNumbers?.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 12 }}>
              Números sorteados até agora ({game.accumulatedNumbers.length}/6)
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[...game.accumulatedNumbers].sort((a, b) => a - b).map((n, i) => (
                <span key={n} className="drawn-ball" style={{ animationDelay: `${i * 0.07}s` }}>
                  {String(n).padStart(2, '0')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div style={{ marginTop: '2.5rem' }}>
          {isAuthenticated ? (
            <Link to="/jogar" className="btn btn-primary" style={{ fontSize: 16, padding: '18px 36px' }}>
              Fazer Minha Aposta
            </Link>
          ) : (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/cadastro" className="btn btn-primary" style={{ fontSize: 16, padding: '18px 36px' }}>
                Começar Agora — R$ 30/cartela
              </Link>
              <Link to="/login" className="btn btn-ghost">
                Já tenho conta
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Grade de prêmios ── */}
      <div className="prize-grid">
        <div className="prize-card top">
          <div className="prize-icon">🏆</div>
          <div className="prize-name">6 Acertos</div>
          <div className="prize-pct gold">65%</div>
          <div className="prize-desc">do fundo total</div>
        </div>
        <div className="prize-card">
          <div className="prize-icon">🔥</div>
          <div className="prize-name">Pé Quente (5)</div>
          <div className="prize-pct" style={{ color: 'var(--warning)' }}>10%</div>
          <div className="prize-desc">do fundo total</div>
        </div>
        <div className="prize-card">
          <div className="prize-icon">❄️</div>
          <div className="prize-name">Pé Frio (0)</div>
          <div className="prize-pct" style={{ color: '#60a5fa' }}>5%</div>
          <div className="prize-desc">do fundo total</div>
        </div>
        <div className="prize-card">
          <div className="prize-icon">🏦</div>
          <div className="prize-name">Casa</div>
          <div className="prize-pct" style={{ color: 'rgba(250,247,240,.4)' }}>20%</div>
          <div className="prize-desc">administração</div>
        </div>
      </div>

      {/* ── Como funciona ── */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 className="section-title">Como <span>funciona</span></h2>
        <div className="grid-4">
          {steps.map((step, i) => (
            <div key={i} className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.2rem', marginBottom: 14 }}>{step.icon}</div>
              <h4 style={{ marginBottom: 8, fontFamily: "'Cormorant Garamond', serif", fontSize: 20 }}>
                {step.title}
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Último Resultado Mega Sena ── */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Último <span>Resultado</span> Mega Sena</h2>
          {megaSena && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Concurso #{megaSena.contestNumber} · {megaSena.drawDateFormatted}
              {megaSena.accumulated && (
                <span style={{ marginLeft: 8, color: 'var(--warning)', fontWeight: 600 }}>ACUMULADO</span>
              )}
            </span>
          )}
        </div>

        {msLoading ? (
          <div className="card" style={{ textAlign: 'center', padding: 32 }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : megaSena ? (
          <div className="card">
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
              Dezenas sorteadas
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              {megaSena.numbers.map((n, i) => (
                <span key={n} className="drawn-ball" style={{ animationDelay: `${i * 0.08}s` }}>
                  {String(n).padStart(2, '0')}
                </span>
              ))}
            </div>

            {megaSena.prizes?.length > 0 && (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Faixa</th><th>Ganhadores</th><th>Prêmio individual</th></tr>
                  </thead>
                  <tbody>
                    {megaSena.prizes.map((p, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{p.tier}</td>
                        <td>{p.winners}</td>
                        <td style={{ color: p.prize > 0 ? 'var(--gold)' : 'var(--text-muted)' }}>
                          {p.prize > 0
                            ? `R$ ${Number(p.prize).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {megaSena.nextPrizeEstimate > 0 && (
              <p style={{ marginTop: 14, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Estimativa próximo concurso:{' '}
                <strong style={{ color: 'var(--gold)' }}>
                  R$ {Number(megaSena.nextPrizeEstimate).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </p>
            )}

            <p style={{ marginTop: 10, fontSize: '0.72rem', color: 'rgba(255,255,255,.25)' }}>
              Atualizado automaticamente a cada 5 minutos · Fonte: Caixa Econômica Federal
            </p>
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Resultado indisponível no momento. Verifique diretamente no site da Caixa Econômica Federal.
          </div>
        )}
      </div>

      {/* ── Botão final ── */}
      <Link to={isAuthenticated ? '/jogar' : '/cadastro'} className="btn btn-primary btn-full" style={{ fontSize: 16, padding: 18 }}>
        Comprar Cartelas — R$ 30,00 cada
      </Link>
    </div>
  );
}

const steps = [
  { icon: '📝', title: 'Cadastre-se',         desc: 'Crie sua conta com apelido e senha em segundos.' },
  { icon: '🎯', title: 'Escolha os números',  desc: 'Selecione 6 números de 1 a 60 por cartela.' },
  { icon: '💳', title: 'Pague com PIX',       desc: 'R$ 30 por cartela. Pagamento instantâneo e seguro.' },
  { icon: '🏆', title: 'Acumule e ganhe',     desc: 'Acertos acumulam sorteio a sorteio até completar 6.' },
];
