import React, { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const WHATSAPP = import.meta.env.VITE_ADMIN_WHATSAPP || '5517991571909';

export default function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp || '');
  const [savingWpp, setSavingWpp] = useState(false);

  function handleChange(e) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      return toast.error('As senhas não coincidem.');
    }
    setLoading(true);
    try {
      await api.put('/users/me/password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Senha alterada com sucesso!');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao alterar senha.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveWhatsapp(e) {
    e.preventDefault();
    setSavingWpp(true);
    try {
      await api.patch('/users/me', { whatsapp: whatsapp.replace(/\D/g, '') || null });
      toast.success('WhatsApp atualizado!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar.');
    } finally {
      setSavingWpp(false);
    }
  }

  const forgotMsg = encodeURIComponent(
    `Olá! Preciso redefinir minha senha no Bolão Mega Sena.\nMeu apelido: ${user?.nickname}`
  );

  return (
    <div className="container" style={{ padding: '2.5rem 24px 4rem', maxWidth: 560 }}>
      <h2 className="section-title" style={{ marginBottom: 8 }}>Meu <span>Perfil</span></h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 32 }}>
        Apelido: <strong style={{ color: 'var(--gold2)' }}>{user?.nickname}</strong>
      </p>

      {/* ── Alterar WhatsApp ── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h4 style={{ marginBottom: 16 }}>Contato WhatsApp</h4>
        <form onSubmit={handleSaveWhatsapp}>
          <div className="input-group">
            <label>Número WhatsApp (somente dígitos, com DDD)</label>
            <input
              className="input"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="Ex: 17991571909"
              maxLength={15}
              inputMode="numeric"
            />
          </div>
          <button type="submit" className="btn btn-secondary" disabled={savingWpp}>
            {savingWpp ? 'Salvando...' : 'Salvar WhatsApp'}
          </button>
        </form>
      </div>

      {/* ── Alterar Senha ── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h4 style={{ marginBottom: 16 }}>Alterar Senha</h4>
        <form onSubmit={handleChangePassword}>
          <div className="input-group">
            <label>Senha atual</label>
            <input
              className="input" type="password" name="currentPassword"
              value={form.currentPassword} onChange={handleChange}
              placeholder="••••••••" required autoComplete="current-password"
            />
          </div>
          <div className="input-group">
            <label>Nova senha</label>
            <input
              className="input" type="password" name="newPassword"
              value={form.newPassword} onChange={handleChange}
              placeholder="Mín. 8 caracteres, 1 maiúscula, 1 número"
              required minLength={8} autoComplete="new-password"
            />
          </div>
          <div className="input-group">
            <label>Confirmar nova senha</label>
            <input
              className="input" type="password" name="confirmPassword"
              value={form.confirmPassword} onChange={handleChange}
              placeholder="Repita a nova senha"
              required autoComplete="new-password"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Salvando...' : 'Alterar Senha'}
          </button>
        </form>
      </div>

      {/* ── Esqueceu a senha ── */}
      <div className="card" style={{ borderColor: 'rgba(37,211,102,.25)', background: 'rgba(37,211,102,.04)' }}>
        <h4 style={{ marginBottom: 8 }}>Esqueceu a senha?</h4>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 16 }}>
          Se você esqueceu sua senha atual e não consegue fazer login, entre em contato com o administrador pelo WhatsApp para redefinição.
        </p>
        <a
          href={`https://wa.me/${WHATSAPP}?text=${forgotMsg}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', background: '#25D366', color: '#fff',
            borderRadius: 40, fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Falar com o Admin
        </a>
      </div>
    </div>
  );
}
