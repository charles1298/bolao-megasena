import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

const WHATSAPP = import.meta.env.VITE_ADMIN_WHATSAPP || '5517991571909';
const PIX_KEY  = import.meta.env.VITE_PIX_KEY        || '17991571909';

export default function PixModal({ manual, paymentId, pixCode, qrCodeBase64, expiresAt, amount, ticketIds, onClose, onConfirmed }) {
  return manual
    ? <ManualPixModal amount={amount} ticketIds={ticketIds} onClose={onClose} />
    : <AutoPixModal   paymentId={paymentId} pixCode={pixCode} qrCodeBase64={qrCodeBase64}
                      expiresAt={expiresAt} amount={amount} onClose={onClose} onConfirmed={onConfirmed} />;
}

// ─── Modal pagamento manual (sem Mercado Pago) ──────────────────────────────
function ManualPixModal({ amount, ticketIds, onClose }) {
  const [copied, setCopied] = useState(false);

  const qty = ticketIds?.length || 1;
  const whatsappMsg = encodeURIComponent(
    `Olá! Acabei de fazer ${qty} cartela${qty > 1 ? 's' : ''} no Bolão Mega Sena.\n` +
    `Valor pago: R$ ${Number(amount).toFixed(2)}\n` +
    `Segue o comprovante:`
  );

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      setCopied(true);
      toast.success('Chave PIX copiada!');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Erro ao copiar. Selecione manualmente.');
    }
  }

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div style={modal}>
        <div style={modalHeader}>
          <h3 style={{ fontSize: '1.1rem', margin: 0 }}>💳 Pagar com PIX</h3>
          <button onClick={onClose} style={closeBtn} type="button">✕</button>
        </div>

        {/* Cartelas confirmadas */}
        <div style={{ background: 'rgba(38,168,106,.1)', border: '1px solid rgba(38,168,106,.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
          <p style={{ color: '#26A86A', fontWeight: 600, margin: 0, fontSize: '0.9rem' }}>
            ✅ {qty} cartela{qty > 1 ? 's' : ''} criada{qty > 1 ? 's' : ''}! Agora realize o pagamento.
          </p>
        </div>

        {/* Valor */}
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: 4, fontSize: '0.85rem' }}>Valor a pagar</p>
        <p style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--gold)', textAlign: 'center', marginBottom: 24, fontFamily: "'Cormorant Garamond', serif" }}>
          R$ {Number(amount).toFixed(2).replace('.', ',')}
        </p>

        {/* Chave PIX */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
            Chave PIX para transferência:
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
            <span style={{ flex: 1, fontFamily: 'monospace', fontSize: '1rem', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
              {PIX_KEY}
            </span>
            <button
              className="btn btn-primary btn-sm"
              onClick={copyKey}
              type="button"
              style={{ flexShrink: 0, padding: '6px 14px', fontSize: '0.8rem' }}
            >
              {copied ? '✓ Copiado' : '📋 Copiar'}
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
            Tipo: Celular · Beneficiário: Bolão Mega Sena
          </p>
        </div>

        {/* Instrução */}
        <div style={{ background: 'rgba(212,168,67,.07)', border: '1px solid rgba(212,168,67,.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.83rem', margin: 0, lineHeight: 1.6 }}>
            1. Abra seu banco e faça um <strong>PIX</strong> para a chave acima.<br />
            2. Após pagar, <strong>envie o comprovante</strong> pelo WhatsApp abaixo.<br />
            3. Suas cartelas serão ativadas após a confirmação.
          </p>
        </div>

        {/* Botão WhatsApp */}
        <a
          href={`https://wa.me/${WHATSAPP}?text=${whatsappMsg}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '13px 24px',
            background: '#25D366',
            color: '#fff',
            borderRadius: 40,
            fontWeight: 700,
            fontSize: '0.95rem',
            textDecoration: 'none',
            marginBottom: 12,
          }}
        >
          <WhatsAppIcon />
          Enviar comprovante pelo WhatsApp
        </a>

        <button onClick={onClose} className="btn btn-ghost btn-full" type="button" style={{ fontSize: '0.85rem' }}>
          Fechar
        </button>
      </div>
    </div>
  );
}

// ─── Modal pagamento automático (Mercado Pago + QR Code) ───────────────────
function AutoPixModal({ paymentId, pixCode, qrCodeBase64, expiresAt, amount, onClose, onConfirmed }) {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000));
      setTimeLeft(diff);
      if (diff === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  useEffect(() => {
    if (!paymentId) return;
    const interval = setInterval(async () => { await checkStatus(); }, 5000);
    return () => clearInterval(interval);
  }, [paymentId]);

  async function checkStatus() {
    if (checking) return;
    try {
      setChecking(true);
      const { data } = await api.post(`/payments/check/${paymentId}`);
      if (data.status === 'approved') {
        toast.success('Pagamento confirmado! Suas cartelas estão ativas!');
        onConfirmed?.();
        onClose?.();
      }
    } catch { /* silencia */ } finally { setChecking(false); }
  }

  async function copyPix() {
    try {
      await navigator.clipboard.writeText(pixCode);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 3000);
    } catch { toast.error('Erro ao copiar. Selecione manualmente.'); }
  }

  const minutes = timeLeft !== null ? Math.floor(timeLeft / 60) : null;
  const seconds = timeLeft !== null ? timeLeft % 60 : null;
  const expired = timeLeft === 0;

  const whatsappMsg = encodeURIComponent(
    `Olá! Segue comprovante do pagamento do Bolão Mega Sena.\nValor: R$ ${Number(amount).toFixed(2)}\nID pagamento: ${paymentId || '—'}`
  );

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div style={modal}>
        <div style={modalHeader}>
          <h3 style={{ fontSize: '1.1rem', margin: 0 }}>💳 Pagar com PIX</h3>
          <button onClick={onClose} style={closeBtn} type="button">✕</button>
        </div>

        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: 6, fontSize: '0.85rem' }}>Valor a pagar</p>
          <p style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--gold)', marginBottom: 20, fontFamily: "'Cormorant Garamond', serif" }}>
            R$ {Number(amount).toFixed(2).replace('.', ',')}
          </p>

          {qrCodeBase64 && !expired && (
            <div style={{ marginBottom: 20 }}>
              <img
                src={`data:image/png;base64,${qrCodeBase64}`}
                alt="QR Code PIX"
                style={{ width: 220, height: 220, borderRadius: 12, background: '#fff', padding: 8 }}
              />
            </div>
          )}

          {expired ? (
            <div style={expiredBox}>⏰ QR Code expirado. Feche e gere um novo pagamento.</div>
          ) : (
            <>
              {timeLeft !== null && (
                <p style={{ fontSize: '0.875rem', color: timeLeft < 120 ? 'var(--error)' : 'var(--text-muted)', marginBottom: 16 }}>
                  Expira em {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </p>
              )}

              {pixCode && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>Ou use o código Copia e Cola:</p>
                  <div style={pixCodeBox}>
                    <code style={{ fontSize: '0.75rem', wordBreak: 'break-all', color: 'var(--text-secondary)' }}>
                      {pixCode.slice(0, 60)}...
                    </code>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={copyPix} style={{ marginTop: 8, width: '100%' }} type="button">
                    {copied ? '✓ Copiado!' : '📋 Copiar Código PIX'}
                  </button>
                </div>
              )}
            </>
          )}

          <div style={statusBox}>
            {checking
              ? <span style={{ color: 'var(--gold)' }}>⏳ Verificando pagamento...</span>
              : <span style={{ color: 'var(--text-muted)' }}>Aguardando confirmação do banco...</span>}
          </div>

          <button className="btn btn-secondary btn-sm" onClick={checkStatus} disabled={checking || expired} style={{ marginTop: 12, width: '100%' }} type="button">
            {checking ? 'Verificando...' : '🔄 Verificar pagamento'}
          </button>

          {/* Envio de comprovante */}
          <div style={{ marginTop: 20, padding: '14px 16px', background: 'rgba(37,211,102,.07)', border: '1px solid rgba(37,211,102,.2)', borderRadius: 12 }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 10 }}>
              Após pagar, envie o comprovante para confirmar sua aposta:
            </p>
            <a
              href={`https://wa.me/${WHATSAPP}?text=${whatsappMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 22px', background: '#25D366', color: '#fff',
                borderRadius: 40, fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none',
              }}
            >
              <WhatsAppIcon />
              Enviar comprovante
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 };
const modal = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, maxWidth: 420, width: '100%', maxHeight: '90vh', overflowY: 'auto' };
const modalHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 };
const closeBtn = { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' };
const pixCodeBox = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', textAlign: 'left' };
const statusBox = { padding: '10px 16px', background: 'rgba(201,168,76,.05)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.875rem' };
const expiredBox = { padding: '12px 16px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, color: 'var(--error)', fontSize: '0.875rem', marginBottom: 16 };
