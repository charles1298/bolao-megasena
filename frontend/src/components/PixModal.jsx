import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';

// ─── Gerador de payload PIX (BRCode/EMV) ─────────────────────────────────────
function tlv(id, value) {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

function crc16ccitt(str) {
  let crc = 0xFFFF;
  for (const ch of str) {
    crc ^= ch.charCodeAt(0) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xFFFF;
    }
  }
  return crc;
}

function generatePixPayload(pixKey, merchantName, merchantCity, amount) {
  const norm = (s, max) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').substring(0, max).toUpperCase();

  const merchantAccInfo = tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', pixKey));
  const addDataField    = tlv('62', tlv('05', '***'));
  const amountField     = tlv('54', Number(amount).toFixed(2));

  const payload = [
    tlv('00', '01'),
    merchantAccInfo,
    tlv('52', '0000'),
    tlv('53', '986'),
    amountField,
    tlv('58', 'BR'),
    tlv('59', norm(merchantName, 25)),
    tlv('60', norm(merchantCity, 15)),
    addDataField,
    '6304',
  ].join('');

  const crc = crc16ccitt(payload);
  return payload + crc.toString(16).toUpperCase().padStart(4, '0');
}

const WHATSAPP   = import.meta.env.VITE_ADMIN_WHATSAPP;
const PIX_KEY    = import.meta.env.VITE_PIX_KEY || '40470271892';
const PIX_HOLDER = import.meta.env.VITE_PIX_HOLDER || 'Thiago Henrique Isidoro da Silva';
const PIX_BANK   = 'Mercado Pago';

export default function PixModal({ manual, paymentId, pixCode, qrCodeBase64, expiresAt, amount, ticketIds, onClose, onConfirmed }) {
  return manual
    ? <ManualPixModal amount={amount} ticketIds={ticketIds} onClose={onClose} />
    : <AutoPixModal   paymentId={paymentId} pixCode={pixCode} qrCodeBase64={qrCodeBase64}
                      expiresAt={expiresAt} amount={amount} onClose={onClose} onConfirmed={onConfirmed} />;
}

// ─── Modal pagamento manual ──────────────────────────────────────────────────
function ManualPixModal({ amount, ticketIds, onClose }) {
  const [copied,   setCopied]   = useState(false);
  const [checking, setChecking] = useState(false);
  const [approved, setApproved] = useState(false);

  const qty = ticketIds?.length || 1;
  const whatsappMsg = encodeURIComponent(
    `Olá! Acabei de fazer ${qty} cartela${qty > 1 ? 's' : ''} no GoPremiada.\n` +
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

  async function checkApproval() {
    if (!ticketIds?.length || checking) return;
    setChecking(true);
    try {
      const { data } = await api.get('/game/tickets/my');
      const myIds = new Set(ticketIds.map(String));
      const anyActive = data.some(t => myIds.has(String(t.id)) && t.status === 'active');
      if (anyActive) {
        setApproved(true);
        toast.success('🎉 Pagamento confirmado! Suas cartelas estão ativas!', { duration: 6000 });
      } else {
        toast('Pagamento ainda não confirmado. Aguarde o admin aprovar.', { icon: '⏳' });
      }
    } catch {
      toast.error('Erro ao verificar. Tente novamente.');
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (!ticketIds?.length || approved) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get('/game/tickets/my');
        const myIds = new Set(ticketIds.map(String));
        const anyActive = data.some(t => myIds.has(String(t.id)) && t.status === 'active');
        if (anyActive) {
          setApproved(true);
          toast.success('🎉 Pagamento confirmado! Suas cartelas estão ativas!', { duration: 8000 });
          clearInterval(interval);
        }
      } catch { /* silencia */ }
    }, 30000);
    return () => clearInterval(interval);
  }, [ticketIds, approved]);

  if (approved) {
    return (
      <div style={overlay}>
        <div style={modal}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎉</div>
            <h3 style={{ color: 'var(--gold)', marginBottom: 8, fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem' }}>
              Pagamento Confirmado!
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 28 }}>
              Suas {qty} cartela{qty > 1 ? 's estão ativas' : ' está ativa'} e participando do bolão.
            </p>
            <button onClick={onClose} className="btn btn-primary btn-full" type="button">
              Ver minhas cartelas
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div style={modal}>

        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={pixIconBox}>
              <PixIcon />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Pagamento PIX</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {qty} cartela{qty > 1 ? 's' : ''} · GoPremiada
              </div>
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle} type="button" aria-label="Fechar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Valor */}
        <div style={amountCard}>
          <div style={{ fontSize: '0.75rem', letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
            Total a pagar
          </div>
          <div style={{ fontSize: '2.6rem', fontWeight: 700, color: 'var(--gold)', fontFamily: "'Cormorant Garamond', serif", lineHeight: 1.1 }}>
            R$ {Number(amount).toFixed(2).replace('.', ',')}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
            ✅ {qty} cartela{qty > 1 ? 's reservada' : ' reservada'}s · aguardando pagamento
          </div>
        </div>

        {/* QR Code PIX estático */}
        {amount && (
          <div style={{ textAlign: 'center', margin: '4px 0 20px' }}>
            <div style={{ display: 'inline-block', background: '#fff', padding: 10, borderRadius: 14, border: '2px solid rgba(50,188,173,.25)' }}>
              <QRCodeSVG
                value={generatePixPayload(PIX_KEY, PIX_HOLDER, 'SAO PAULO', Number(amount))}
                size={180}
                bgColor="#ffffff"
                fgColor="#000000"
                level="M"
              />
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8 }}>
              Escaneie o QR Code com o app do seu banco
            </div>
          </div>
        )}

        {/* Dados PIX */}
        <div style={{ marginBottom: 16 }}>
          {/* Chave */}
          <div style={pixKeyBox}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 2 }}>Chave PIX (CPF)</div>
              <div style={{ fontFamily: 'monospace', fontSize: '1.05rem', color: 'var(--text-primary)', letterSpacing: '0.05em', fontWeight: 600 }}>
                {PIX_KEY}
              </div>
            </div>
            <button
              className={copied ? 'btn btn-success btn-sm' : 'btn btn-primary btn-sm'}
              onClick={copyKey}
              type="button"
              style={{ flexShrink: 0, minWidth: 90 }}
            >
              {copied ? '✓ Copiado' : '📋 Copiar'}
            </button>
          </div>

          {/* Nome e Banco */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <div style={{ ...pixInfoRow, flex: 2 }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>Beneficiário</div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 600 }}>{PIX_HOLDER}</div>
            </div>
            <div style={{ ...pixInfoRow, flex: 1 }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>Banco</div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 600 }}>{PIX_BANK}</div>
            </div>
          </div>
        </div>

        {/* Instruções */}
        <div style={stepsBox}>
          {[
            { n: '1', text: 'Copie a chave PIX acima e abra o aplicativo do seu banco' },
            { n: '2', text: <>Após pagar, <strong style={{ color: 'var(--text-primary)' }}>envie o comprovante</strong> pelo WhatsApp</> },
            { n: '3', text: 'Suas cartelas serão ativadas assim que confirmado' },
          ].map(({ n, text }) => (
            <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={stepBadge}>{n}</div>
              <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{text}</p>
            </div>
          ))}
        </div>

        {/* Verificar */}
        <button
          className="btn btn-ghost btn-full"
          onClick={checkApproval}
          disabled={checking}
          type="button"
          style={{ marginBottom: 10, fontSize: '0.85rem', border: '1px solid var(--border)' }}
        >
          {checking
            ? <><Spinner /> Verificando...</>
            : '🔄 Verificar se pagamento foi confirmado'}
        </button>

        {/* WhatsApp */}
        <a
          href={`https://wa.me/${WHATSAPP}?text=${whatsappMsg}`}
          target="_blank"
          rel="noopener noreferrer"
          style={whatsappBtn}
        >
          <WhatsAppIcon />
          Enviar comprovante pelo WhatsApp
        </a>
      </div>
    </div>
  );
}

// ─── Modal pagamento automático (Mercado Pago) ────────────────────────────────
function AutoPixModal({ paymentId, pixCode, qrCodeBase64, expiresAt, amount, onClose, onConfirmed }) {
  const [copied,   setCopied]   = useState(false);
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
    `Olá! Segue comprovante do pagamento do GoPremiada.\nValor: R$ ${Number(amount).toFixed(2)}\nID pagamento: ${paymentId || '—'}`
  );

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div style={modal}>

        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={pixIconBox}><PixIcon /></div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Pagamento PIX</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Via Mercado Pago</div>
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle} type="button" aria-label="Fechar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Valor */}
        <div style={amountCard}>
          <div style={{ fontSize: '0.75rem', letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
            Total a pagar
          </div>
          <div style={{ fontSize: '2.6rem', fontWeight: 700, color: 'var(--gold)', fontFamily: "'Cormorant Garamond', serif", lineHeight: 1.1 }}>
            R$ {Number(amount).toFixed(2).replace('.', ',')}
          </div>
        </div>

        {expired && (
          <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 12, color: 'var(--error)', fontSize: '0.875rem', marginBottom: 16, textAlign: 'center' }}>
            ⏰ QR Code expirado. Feche e gere um novo pagamento.
          </div>
        )}

        {/* QR Code */}
        {qrCodeBase64 && !expired && (
          <div style={{ textAlign: 'center', margin: '4px 0 16px' }}>
            <img
              src={`data:image/png;base64,${qrCodeBase64}`}
              alt="QR Code PIX"
              style={{ width: 200, height: 200, borderRadius: 12, border: '2px solid rgba(50,188,173,.25)', background: '#fff', padding: 4 }}
            />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>
              Escaneie o QR Code com o app do seu banco
            </div>
          </div>
        )}

        {/* Código copia e cola */}
        {pixCode && !expired && (
          <>
            <div style={pixKeyBox}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>Código PIX (copia e cola)</div>
                <code style={{ fontSize: '0.72rem', wordBreak: 'break-all', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {pixCode.slice(0, 60)}...
                </code>
              </div>
              <button
                className={copied ? 'btn btn-success btn-sm' : 'btn btn-primary btn-sm'}
                onClick={copyPix}
                type="button"
                style={{ flexShrink: 0, minWidth: 90 }}
              >
                {copied ? '✓ Copiado' : '📋 Copiar'}
              </button>
            </div>
            {timeLeft !== null && (
              <div style={{ fontSize: '0.8rem', color: timeLeft < 120 ? 'var(--error)' : 'var(--text-muted)', textAlign: 'center', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Expira em {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </div>
            )}
          </>
        )}

        {/* Status do pagamento */}
        <div style={{ ...stepsBox, flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', padding: '12px 16px' }}>
          {checking
            ? <><Spinner /><span style={{ fontSize: '0.85rem', color: 'var(--gold)' }}>Verificando pagamento...</span></>
            : <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>⏳ Aguardando confirmação do banco...</span>}
        </div>

        <button
          className="btn btn-ghost btn-full"
          onClick={checkStatus}
          disabled={checking || expired}
          type="button"
          style={{ marginTop: 10, marginBottom: 10, fontSize: '0.85rem', border: '1px solid var(--border)' }}
        >
          {checking ? 'Verificando...' : '🔄 Verificar pagamento'}
        </button>

        {/* WhatsApp */}
        <a
          href={`https://wa.me/${WHATSAPP}?text=${whatsappMsg}`}
          target="_blank"
          rel="noopener noreferrer"
          style={whatsappBtn}
        >
          <WhatsAppIcon />
          Enviar comprovante
        </a>
      </div>
    </div>
  );
}

// ─── Ícones e sub-componentes ─────────────────────────────────────────────────
function PixIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 512 512" fill="none">
      <path d="M326.6 185.4c-13.8 0-26.8 5.4-36.5 15.1l-67.8 67.8c-5.3 5.3-12.3 8.2-19.8 8.2s-14.5-2.9-19.8-8.2l-67.9-67.9c-9.7-9.7-22.7-15.1-36.5-15.1H62l93.6 93.6c26.5 26.5 69.6 26.5 96.1 0l93.6-93.6h-18.7zM185.4 326.6c9.7 9.7 22.7 15.1 36.5 15.1s26.8-5.4 36.5-15.1l67.8-67.8c5.3-5.3 12.3-8.2 19.8-8.2s14.5 2.9 19.8 8.2l67.9 67.9c9.7 9.7 22.7 15.1 36.5 15.1H450l-93.6-93.6c-26.5-26.5-69.6-26.5-96.1 0l-93.6 93.6 18.7-.2z" fill="#32BCAD"/>
      <path d="M62 185.4h16.3c13.8 0 26.8 5.4 36.5 15.1l67.9 67.9c5.3 5.3 12.3 8.2 19.8 8.2s14.5-2.9 19.8-8.2l67.8-67.8c9.7-9.7 22.7-15.1 36.5-15.1H450L356.4 91.8c-26.5-26.5-69.6-26.5-96.1 0L62 290.5v-105.1zm450 141.2h-16.3c-13.8 0-26.8-5.4-36.5-15.1l-67.9-67.9c-5.3-5.3-12.3-8.2-19.8-8.2s-14.5 2.9-19.8 8.2l-67.8 67.8c-9.7 9.7-22.7 15.1-36.5 15.1H62l93.6 93.6c26.5 26.5 69.6 26.5 96.1 0L512 221.5v105.1z" fill="#32BCAD" opacity=".7"/>
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function Spinner() {
  return <div style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />;
}

// ─── Estilos compartilhados ───────────────────────────────────────────────────
const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.8)',
  backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 16,
};

const modal = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 20,
  padding: '24px 24px 20px',
  maxWidth: 400,
  width: '100%',
  maxHeight: '92vh',
  overflowY: 'auto',
  boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
};

const headerStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  marginBottom: 20,
};

const pixIconBox = {
  width: 40, height: 40,
  borderRadius: 10,
  background: 'rgba(50,188,173,.12)',
  border: '1px solid rgba(50,188,173,.25)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
};

const closeBtnStyle = {
  width: 34, height: 34,
  borderRadius: 8,
  background: 'rgba(255,255,255,.06)',
  border: '1px solid var(--border)',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background .15s, color .15s',
  flexShrink: 0,
};

const amountCard = {
  background: 'linear-gradient(135deg, rgba(212,168,67,.1) 0%, rgba(212,168,67,.04) 100%)',
  border: '1px solid rgba(212,168,67,.2)',
  borderRadius: 14,
  padding: '16px 20px',
  marginBottom: 20,
  textAlign: 'center',
};

const pixKeyBox = {
  display: 'flex', alignItems: 'center', gap: 10,
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '10px 14px',
  marginBottom: 8,
};

const pixInfoRow = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '8px 12px',
};

const stepsBox = {
  background: 'rgba(255,255,255,.03)',
  border: '1px solid rgba(255,255,255,.07)',
  borderRadius: 12,
  padding: '14px 16px',
  display: 'flex', flexDirection: 'column', gap: 10,
  marginBottom: 16,
};

const stepBadge = {
  width: 22, height: 22, borderRadius: '50%',
  background: 'rgba(212,168,67,.15)',
  border: '1px solid rgba(212,168,67,.3)',
  color: 'var(--gold)',
  fontSize: '0.72rem',
  fontWeight: 700,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
};

const whatsappBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  padding: '13px 24px',
  background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
  color: '#fff',
  borderRadius: 12,
  fontWeight: 700,
  fontSize: '0.95rem',
  textDecoration: 'none',
  boxShadow: '0 4px 16px rgba(37,211,102,.25)',
  marginTop: 4,
};
