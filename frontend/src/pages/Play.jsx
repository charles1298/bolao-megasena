import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import NumberPicker from '../components/NumberPicker';
import PixModal from '../components/PixModal';
import api from '../services/api';

// Tick a cada 1s — usado pra reagir ao fechamento automático sem precisar de reload
function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Play() {
  const [game,        setGame]        = useState(null);
  const [cart,        setCart]        = useState([]);
  const [currentPick, setCurrentPick] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [paying,      setPaying]      = useState(false);
  const [pixData,     setPixData]     = useState(null);
  const now = useNow(1000);

  function refetch() {
    return api.get('/game/current')
      .then(({ data }) => setGame(data))
      .catch(() => {});
  }

  useEffect(() => {
    api.get('/game/current')
      .then(({ data }) => setGame(data))
      .catch(() => toast.error('Erro ao carregar jogo.'))
      .finally(() => setLoading(false));

    // Re-busca a cada 30s pra refletir mudanças (admin pode travar/destravar)
    const poll = setInterval(() => {
      api.get('/game/current').then(({ data }) => setGame(data)).catch(() => {});
    }, 30_000);
    return () => clearInterval(poll);
  }, []);

  // Fecha imediatamente quando o relógio cruza o autoCloseAt — não espera o poll.
  // ATENÇÃO: este useEffect precisa estar ANTES dos early returns pra não violar as Rules of Hooks.
  const cutoffMs    = game?.autoCloseAt ? new Date(game.autoCloseAt).getTime() : null;
  const localClosed = cutoffMs ? now >= cutoffMs : false;
  useEffect(() => {
    if (game && game.isOpen && localClosed) refetch();
  }, [localClosed]); // eslint-disable-line

  function addToCart() {
    if (currentPick.length !== 8) { toast.error('Selecione exatamente 8 números.'); return; }
    setCart((prev) => [...prev, [...currentPick]]);
    setCurrentPick([]);
    toast.success(`Cartela ${cart.length + 1} adicionada!`);
  }

  function removeFromCart(index) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  async function checkout() {
    if (cart.length === 0) { toast.error('Adicione pelo menos uma cartela.'); return; }
    setPaying(true);
    try {
      const { data } = await api.post('/game/tickets', { numbers: cart });
      if (data.pixError) {
        // PIX automático falhou — exibe modal de pagamento manual
        setPixData({
          manual:    true,
          amount:    data.totalAmount,
          ticketIds: data.ticketIds,
        });
        setCart([]);
        return;
      }
      setPixData({
        paymentId:    data.paymentId,
        pixCode:      data.pix.pixCode,
        qrCodeBase64: data.pix.qrCodeBase64,
        expiresAt:    data.pix.expiresAt,
        amount:       data.totalAmount,
      });
      setCart([]);
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Erro ao processar pagamento.');
    } finally {
      setPaying(false);
    }
  }

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  if (!game) {
    return (
      <div className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <h2>Nenhum jogo ativo</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Aguarde o início do próximo bolão.</p>
      </div>
    );
  }

  const ticketPrice = game.ticketPrice ?? 30;
  const total = cart.length * ticketPrice;
  const bettingClosed = !game.isOpen || localClosed;

  return (
    <div className="container page-enter" style={{ padding: '2.5rem 24px 4rem' }}>

      {/* Banner de status das apostas */}
      {bettingClosed && (
        <div style={{
          marginBottom: 24, padding: '14px 20px',
          background: game.status === 'finished'
            ? 'rgba(212,168,67,.08)' : 'rgba(220,60,60,.07)',
          border: `1px solid ${game.status === 'finished' ? 'rgba(212,168,67,.3)' : 'rgba(220,60,60,.3)'}`,
          borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 22 }}>{game.status === 'finished' ? '🏆' : '🔒'}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: game.status === 'finished' ? 'var(--gold2)' : 'var(--error)' }}>
              {game.status === 'finished' ? 'Jogo encerrado — aguardando novo ciclo' : 'Apostas encerradas'}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {game.status === 'finished'
                ? 'Este jogo já tem um ganhador. Um novo bolão será aberto em breve.'
                : 'As apostas foram fechadas pelo administrador.'}
            </div>
          </div>
        </div>
      )}

      {/* Card de prêmio estimado */}
      <div style={{
        marginBottom: 24,
        background: 'linear-gradient(135deg, rgba(212,168,67,.13) 0%, rgba(212,168,67,.04) 100%)',
        border: '1px solid rgba(212,168,67,.28)',
        borderRadius: 16, padding: '18px 22px',
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{
            fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em',
            color: 'var(--text-muted)', marginBottom: 4,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            Prêmio Estimado
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'rgba(38,168,106,.15)', border: '1px solid rgba(38,168,106,.3)',
              borderRadius: 20, padding: '1px 6px',
              fontSize: '0.55rem', fontWeight: 700, color: '#6EE7A8',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#6EE7A8', animation: 'livePulse 1.4s ease infinite', flexShrink: 0 }} />
              Ao Vivo
            </span>
          </div>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
            fontWeight: 700, color: 'var(--gold)', lineHeight: 1,
          }}>
            {Number(game.estimatedPrize ?? Number(game.totalPot) * 0.79).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Cartelas</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--gold2)', fontFamily: "'Cormorant Garamond', serif" }}>
              {game.activeTickets ?? 0}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Sorteios</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: "'Cormorant Garamond', serif" }}>
              {game.drawCount ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20, marginBottom: 28 }}>
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>
            Escolha seus <span>números</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{game.name} — R$ {ticketPrice.toFixed(2).replace('.', ',')} por cartela</p>
        </div>

      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Seletor */}
        <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
          <div className="card" style={bettingClosed ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
            <h3 style={{ marginBottom: 6, fontFamily: "'Cormorant Garamond', serif", fontSize: 22 }}>
              Cartela {cart.length + 1}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>
              {bettingClosed
                ? 'Apostas encerradas para este jogo.'
                : (game.accumulatedNumbers?.length > 0
                    ? 'Clique nos números para selecionar 8. Os números já sorteados estão bloqueados.'
                    : 'Clique nos números para selecionar 8.')}
            </p>
            <NumberPicker
              selected={currentPick}
              onChange={bettingClosed ? () => {} : setCurrentPick}
              hitNumbers={game.accumulatedNumbers || []}
            />
            <button
              className="btn btn-secondary btn-full"
              style={{ marginTop: 20 }}
              onClick={addToCart}
              disabled={currentPick.length !== 8 || bettingClosed}
              type="button"
            >
              + Adicionar Cartela
            </button>
          </div>
        </div>

        {/* Carrinho */}
        <div style={{ width: '100%', maxWidth: 420, flexShrink: 0 }}>
          <div className="card">
            <h3 style={{ marginBottom: 16, fontFamily: "'Cormorant Garamond', serif", fontSize: 22 }}>
              Suas <span style={{ color: 'var(--gold2)' }}>cartelas</span>
              {cart.length > 0 && (
                <span style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: 'Outfit', marginLeft: 8 }}>
                  ({cart.length})
                </span>
              )}
            </h3>

            {cart.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '24px 0' }}>
                Nenhuma cartela adicionada ainda.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cart.map((nums, i) => (
                  <div key={i} className="cart-item" style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,.04)',
                    border: '1px solid rgba(255,255,255,.07)',
                    borderRadius: 12,
                    transition: 'border-color .2s, box-shadow .2s',
                    animationDelay: `${i * 0.04}s`,
                  }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
                      {nums.map((n) => (
                        <span key={n}
                          className="number-ball number-ball-selected"
                          style={{ width: 28, height: 28, fontSize: '0.68rem' }}
                        >
                          {String(n).padStart(2, '0')}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => removeFromCart(i)}
                      style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 4, flexShrink: 0, fontSize: 16 }}
                      type="button"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="divider" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Total</span>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', color: 'var(--gold2)' }}>
                R$ {total.toFixed(2).replace('.', ',')}
              </span>
            </div>

            <button
              className="btn btn-primary btn-full"
              onClick={checkout}
              disabled={cart.length === 0 || paying || bettingClosed}
              type="button"
              title={bettingClosed ? 'Apostas encerradas' : undefined}
            >
              {paying
                ? <><div className="spinner" style={{ width: 18, height: 18 }} /> Gerando PIX...</>
                : bettingClosed
                  ? '🔒 Apostas encerradas'
                  : <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> Pagar com PIX</>}
            </button>
          </div>
        </div>
      </div>

      {pixData && (
        <PixModal
          {...pixData}
          onClose={() => setPixData(null)}
          onConfirmed={() => toast.success('Pagamento confirmado! Veja suas cartelas no painel.')}
        />
      )}
    </div>
  );
}
