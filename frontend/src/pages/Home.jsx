import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DATA_INICIO, DATA_FECHAMENTO } from '../config/bolao';

/* ── Hook de Scroll Reveal ── */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('revealed'); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

/* ── SVG Icons ── */
function IconRegister() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="8" r="4"/><path d="M2 20c0-4 3.6-7 8-7"/>
      <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
    </svg>
  );
}
function IconNumbers() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6"  cy="6"  r="2.5" fill="currentColor" fillOpacity=".3"/>
      <circle cx="12" cy="6"  r="2.5" fill="currentColor" fillOpacity=".3"/>
      <circle cx="18" cy="6"  r="2.5" fill="currentColor" fillOpacity=".3"/>
      <circle cx="6"  cy="12" r="2.5" fill="currentColor" fillOpacity=".3"/>
      <circle cx="12" cy="12" r="2.5"/>
      <circle cx="18" cy="12" r="2.5" fill="currentColor" fillOpacity=".3"/>
      <circle cx="6"  cy="18" r="2.5" fill="currentColor" fillOpacity=".3"/>
      <circle cx="12" cy="18" r="2.5" fill="currentColor" fillOpacity=".3"/>
      <circle cx="18" cy="18" r="2.5" fill="currentColor" fillOpacity=".3"/>
    </svg>
  );
}
function IconPix() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
      <line x1="6" y1="15" x2="10" y2="15"/>
    </svg>
  );
}
function IconTrophy() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4"/>
      <path d="M7 4h10l-1 7a4 4 0 01-8 0L7 4z"/>
      <path d="M7 4c0-1-2-1.5-2-3h2M17 4c0-1 2-1.5 2-3h-2"/>
    </svg>
  );
}
function IconTrophyLg() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4"/>
      <path d="M7 4h10l-1 7a4 4 0 01-8 0L7 4z"/>
      <path d="M7 4c0-1-2-1.5-2-3h2M17 4c0-1 2-1.5 2-3h-2"/>
    </svg>
  );
}
function IconFlame() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2c1 4-3 5.5-3 9a5 5 0 0010 0c0-5-4-6-3.5-10-1.5 2.5-4 3-4 1z"/>
      <path d="M12 12c.5 2-1 3-1 4.5a2.5 2.5 0 005 0C16 15 14 14 14 12c-.5 1-1.5 1.5-2 0z"/>
    </svg>
  );
}
function IconSnowflake() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
      <line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  );
}

/* ── Próximo sorteio (Ter/Qui/Sáb) ── */
function getNextDraw() {
  const now   = new Date();
  const days  = [2, 4, 6]; // Ter=2, Qui=4, Sáb=6
  const today = now.getDay();
  let diff = days.map((d) => (d - today + 7) % 7 || 7);
  const minDiff = Math.min(...diff);
  const next  = new Date(now);
  next.setDate(now.getDate() + minDiff);
  next.setHours(21, 0, 0, 0); // sorteio às 21h
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

/* ── Banner de contagem regressiva — datas gerenciadas pelo admin ── */
function GameBanner({ game, dataInicio, dataFechamento }) {
  // Prioriza datas do jogo ativo (geridas pelo admin no painel) sobre as configs estáticas
  const inicio       = game?.startDate   || dataInicio     || DATA_INICIO;
  const fechamento   = game?.autoCloseAt || dataFechamento || DATA_FECHAMENTO;
  const fechamentoMs = new Date(fechamento).getTime();
  const countdown    = useCountdown(fechamentoMs);

  // Sem jogo ativo: aguardando próximo bolão (admin ainda não criou ou já terminou)
  const noGame = !game;
  // Encerra imediatamente quando o relógio cruza o autoCloseAt — não espera o próximo poll.
  // O backend se atualiza no próximo poll de 30s do Home.
  const localExpired = Date.now() >= fechamentoMs;
  const expired      = game && (!game.isOpen || localExpired);

  const fmtInicio = new Date(inicio).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const fmtFecha = new Date(fechamento).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  /* ── Sem jogo ativo: aguardando próximo bolão ── */
  if (noGame) {
    return (
      <div style={{
        background: 'rgba(212,168,67,.06)',
        border: '1px solid rgba(212,168,67,.22)',
        borderRadius: 16, padding: '18px 24px', marginBottom: 28,
        display: 'flex', alignItems: 'center', gap: 14,
        animation: 'fadeIn .4s ease',
      }}>
        <span style={{ fontSize: 26, flexShrink: 0 }}>⏳</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--gold2)' }}>
            Aguarde o próximo bolão
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3 }}>
            Em breve um novo ciclo será aberto. Fique de olho!
          </div>
        </div>
      </div>
    );
  }

  /* ── Apostas encerradas ── */
  if (expired) {
    return (
      <div style={{
        background: 'rgba(220,60,60,.07)',
        border: '1px solid rgba(220,60,60,.3)',
        borderRadius: 16, padding: '18px 24px', marginBottom: 28,
        display: 'flex', alignItems: 'center', gap: 14,
        animation: 'fadeIn .4s ease',
      }}>
        <span style={{ fontSize: 26, flexShrink: 0 }}>🔒</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--error)' }}>
            Apostas encerradas
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3 }}>
            {game.status === 'finished'
              ? 'Este bolão já foi finalizado. Aguarde o próximo ciclo.'
              : 'O período de apostas foi encerrado. Aguarde o próximo bolão.'}
          </div>
        </div>
      </div>
    );
  }

  /* ── Contador regressivo ── */
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(212,168,67,.13) 0%, rgba(212,168,67,.03) 100%)',
      border: '1px solid rgba(212,168,67,.32)',
      borderRadius: 18, padding: '22px 26px', marginBottom: 28,
      animation: 'fadeIn .5s ease',
    }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: 'rgba(212,168,67,.15)', border: '1px solid rgba(212,168,67,.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>🎯</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--gold)', lineHeight: 1.3 }}>
            O bolão começa em {fmtInicio}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 5 }}>
            Apostas encerram em&nbsp;
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{fmtFecha}</span>
          </div>
        </div>
      </div>

      {/* Blocos do contador */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { v: countdown.d, l: 'Dias' },
          { v: countdown.h, l: 'Horas' },
          { v: countdown.m, l: 'Min' },
        ].map(({ v, l }) => (
          <div key={l} style={{
            flex: '1 1 72px', maxWidth: 96,
            background: 'rgba(212,168,67,.11)',
            border: '1px solid rgba(212,168,67,.22)',
            borderRadius: 14, padding: '12px 8px',
            textAlign: 'center',
          }}>
            <div style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
              fontWeight: 700, color: 'var(--gold)', lineHeight: 1,
            }}>{v}</div>
            <div style={{
              fontSize: '0.6rem', color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 4,
            }}>{l}</div>
          </div>
        ))}

        {/* CTA dentro do banner */}
        <Link to="/jogar" className="btn btn-primary" style={{
          flex: '1 1 120px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', borderRadius: 14, fontSize: '0.88rem',
          padding: '12px 18px', textDecoration: 'none',
        }}>
          Apostar agora →
        </Link>
      </div>
    </div>
  );
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [game,       setGame]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [settings,   setSettings]   = useState({ dataInicio: null, dataFechamento: null });

  // Contador único: alinha com o fechamento de apostas do jogo ativo
  // (mesma fonte usada pelo banner de cima, garantindo sincronia)
  const closeTarget = new Date(
    game?.autoCloseAt || settings.dataFechamento || DATA_FECHAMENTO
  ).getTime();
  const countdown = useCountdown(closeTarget);

  useEffect(() => {
    Promise.all([
      api.get('/game/current').catch(() => ({ data: null })),
      api.get('/game/settings').catch(() => ({ data: { dataInicio: null, dataFechamento: null } })),
    ]).then(([gameRes, settingsRes]) => {
      setGame(gameRes.data);
      setSettings(settingsRes.data);
    }).finally(() => setLoading(false));

    // Atualiza o prêmio estimado a cada 30 segundos conforme novas apostas chegam
    const poll = setInterval(() => {
      api.get('/game/current')
        .then(({ data }) => setGame(data))
        .catch(() => {});
    }, 30_000);

    return () => clearInterval(poll);
  }, []);


  const estimatedPrize = game
    ? Number(game.estimatedPrize ?? Number(game.totalPot) * 0.79).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'R$ 0,00';

  const stepsRef  = useReveal();
  const prizeRef  = useReveal();

  return (
    <div className="container page-enter" style={{ paddingBottom: '4rem' }}>

      {/* ── Banner de status do bolão ── */}
      <GameBanner game={game} dataInicio={settings.dataInicio} dataFechamento={settings.dataFechamento} />

      {/* ── Hero ── */}
      <div className="hero-section fade-in">
        <div className="hero-deco"  />
        <div className="hero-deco2" />

        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <img
            src="/logo.png"
            alt="GoPremiada"
            style={{ height: 120, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 4px 24px rgba(212,168,67,0.25))' }}
          />
        </div>

        <div className="hero-live-tag">
          <span className="hero-live-dot" />
          Mega Sena Oficial — Ao Vivo
        </div>

        <h1 className="hero-title">
          Jogue pela<br /><em>sua sorte</em>
        </h1>
        <p className="hero-sub">
          Acerte os 8 números e leve o prêmio acumulado do bolão
        </p>

        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Bloco de prêmio + countdown */}
          <div className="prize-block">
            <div className="prize-lbl" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              Prêmio Estimado
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'rgba(38,168,106,.18)', border: '1px solid rgba(38,168,106,.35)',
                borderRadius: 20, padding: '2px 8px',
                fontSize: '0.6rem', fontWeight: 700, color: '#6EE7A8',
                textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#6EE7A8', animation: 'livePulse 1.4s ease infinite',
                  flexShrink: 0,
                }} />
                Ao Vivo
              </span>
            </div>
            <div className="prize-val" key={estimatedPrize}
              style={{ transition: 'opacity .3s ease' }}>
              {loading ? '...' : estimatedPrize}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'rgba(212,168,67,.7)', marginBottom: 10 }}>
              Ganhador único · <strong style={{ color: 'var(--gold2)' }}>acerte os 8 números</strong>
            </div>
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
              Cartela: <strong>R$ {game ? Number(game.ticketPrice ?? 30).toFixed(2).replace('.', ',') : '30,00'}</strong>
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

        {/* Números sorteados — separados por sorteio (mais recente primeiro) */}
        {game?.draws?.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 12 }}>
              Números sorteados · {game.draws.length} sorteio{game.draws.length > 1 ? 's' : ''} ({game.accumulatedNumbers?.length || 0} dezenas)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...game.draws].sort((a, b) => b.drawOrder - a.drawOrder).map((draw) => (
                <div key={draw.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,.03)',
                  border: '1px solid rgba(255,255,255,.06)',
                  borderRadius: 12,
                }}>
                  <div style={{ minWidth: 96 }}>
                    <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,.35)' }}>
                      Sorteio #{draw.drawOrder}
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {new Date(draw.drawDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[...draw.numbers].sort((a, b) => a - b).map((n) => (
                      <span key={n} className="drawn-ball">
                        {String(n).padStart(2, '0')}
                      </span>
                    ))}
                  </div>
                </div>
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
                Começar Agora — R$ {game ? Number(game.ticketPrice ?? 30).toFixed(2).replace('.', ',') : '30,00'}/cartela
              </Link>
              <Link to="/login" className="btn btn-ghost">
                Já tenho conta
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Prêmio ── */}
      <div ref={prizeRef} className="prize-grid reveal-hidden">
        <div className="prize-card top stagger-1">
          <div className="prize-icon-wrap prize-icon-gold"><IconTrophyLg /></div>
          <div className="prize-name">Prêmio Único — Acerte os 8</div>
        </div>
      </div>

      {/* ── Como funciona ── */}
      <div ref={stepsRef} className="reveal-hidden" style={{ marginBottom: '2.5rem' }}>
        <h2 className="section-title">Como <span>funciona</span></h2>
        <div className="grid-4">
          {steps.map((step, i) => (
            <div key={i} className={`card stagger-${i + 1}`} style={{ textAlign: 'center' }}>
              <div className="step-icon"><step.Icon /></div>
              <h4 style={{ marginBottom: 8, fontFamily: "'Cormorant Garamond', serif", fontSize: 20 }}>
                {step.title}
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Botão final ── */}
      <Link to={isAuthenticated ? '/jogar' : '/cadastro'} className="btn btn-primary btn-full" style={{ fontSize: 16, padding: 18 }}>
        Comprar Cartelas — R$ {game ? Number(game.ticketPrice ?? 30).toFixed(2).replace('.', ',') : '30,00'} cada
      </Link>
    </div>
  );
}

const steps = [
  { Icon: IconRegister, title: 'Cadastre-se',        desc: 'Crie sua conta com apelido e senha em segundos.' },
  { Icon: IconNumbers,  title: 'Escolha os números', desc: 'Selecione 8 números de 1 a 60 por cartela.' },
  { Icon: IconPix,      title: 'Pague com PIX',      desc: 'R$ 30 por cartela. Pagamento instantâneo e seguro.' },
  { Icon: IconTrophy,   title: 'Acumule e ganhe',    desc: 'Acertos acumulam sorteio a sorteio até completar os 8.' },
];
