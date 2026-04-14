import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import NumberPicker from '../components/NumberPicker';
import PixModal from '../components/PixModal';
import api from '../services/api';

export default function Play() {
  const [game,        setGame]        = useState(null);
  const [cart,        setCart]        = useState([]);
  const [currentPick, setCurrentPick] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [paying,      setPaying]      = useState(false);
  const [pixData,     setPixData]     = useState(null);

  useEffect(() => {
    api.get('/game/current')
      .then(({ data }) => setGame(data))
      .catch(() => toast.error('Erro ao carregar jogo.'))
      .finally(() => setLoading(false));
  }, []);

  function addToCart() {
    if (currentPick.length !== 6) { toast.error('Selecione exatamente 6 números.'); return; }
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

  return (
    <div className="container" style={{ padding: '2.5rem 24px 4rem' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20, marginBottom: 28 }}>
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>
            Escolha seus <span>números</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{game.name} — R$ {ticketPrice.toFixed(2).replace('.', ',')} por cartela</p>
        </div>

        {game.accumulatedNumbers?.length > 0 && (
          <div style={{
            background: 'rgba(255,255,255,.04)',
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 14, padding: '12px 16px',
          }}>
            <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
              Acumulados até agora
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {[...game.accumulatedNumbers].sort((a, b) => a - b).map((n) => (
                <span key={n} className="number-ball number-ball-hit" style={{ width: 32, height: 32, fontSize: '0.72rem', cursor: 'default' }}>
                  {String(n).padStart(2, '0')}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Seletor */}
        <div style={{ flex: 1, minWidth: 300 }}>
          <div className="card">
            <h3 style={{ marginBottom: 6, fontFamily: "'Cormorant Garamond', serif", fontSize: 22 }}>
              Cartela {cart.length + 1}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>
              Clique nos números para selecionar 6.
            </p>
            <NumberPicker selected={currentPick} onChange={setCurrentPick} />
            <button
              className="btn btn-secondary btn-full"
              style={{ marginTop: 20 }}
              onClick={addToCart}
              disabled={currentPick.length !== 6}
              type="button"
            >
              + Adicionar Cartela
            </button>
          </div>
        </div>

        {/* Carrinho */}
        <div style={{ width: 290, flexShrink: 0 }}>
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
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,.04)',
                    border: '1px solid rgba(255,255,255,.07)',
                    borderRadius: 12,
                    transition: 'border-color .2s',
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
              disabled={cart.length === 0 || paying}
              type="button"
            >
              {paying
                ? <><div className="spinner" style={{ width: 18, height: 18 }} /> Gerando PIX...</>
                : '💸 Pagar com PIX'}
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
