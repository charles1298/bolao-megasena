import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from?.pathname || '/painel';

  const [form,        setForm]        = useState({ nickname: '', password: '', totpToken: '' });
  const [requires2FA, setRequires2FA] = useState(false);
  const [loading,     setLoading]     = useState(false);

  const sessionExpired = new URLSearchParams(location.search).get('session') === 'expired';

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(
        form.nickname.trim(),
        form.password,
        requires2FA ? form.totpToken : undefined,
      );
      if (result.requires2FA) {
        setRequires2FA(true);
        toast('Digite o código do Google Authenticator.', { icon: '🔐' });
        return;
      }
      toast.success(`Bem-vindo, ${result.user.nickname}!`);
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 110px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div className="card fade-in" style={{ width: '100%', maxWidth: 420, position: 'relative' }}>

        {/* Decoração */}
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 160, height: 160, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,168,67,.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 36, fontFamily: "'Cormorant Garamond', serif", marginBottom: 6 }}>
            Bem-vindo!
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Acesse sua conta do Bolão Mega Sena
          </p>
        </div>

        {sessionExpired && (
          <div style={{
            padding: '10px 16px', marginBottom: 20,
            background: 'rgba(245,158,11,.08)',
            border: '1px solid rgba(245,158,11,.25)',
            borderRadius: 10, color: 'var(--warning)', fontSize: '0.875rem',
          }}>
            ⚠️ Sessão expirada. Faça login novamente.
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="off">
          {!requires2FA ? (
            <>
              <div className="input-group">
                <label htmlFor="nickname">Apelido</label>
                <input
                  id="nickname" name="nickname" className="input" type="text"
                  value={form.nickname} onChange={handleChange}
                  placeholder="Seu apelido no bolão"
                  required autoFocus maxLength={30} autoComplete="username"
                />
              </div>
              <div className="input-group">
                <label htmlFor="password">Senha</label>
                <input
                  id="password" name="password" className="input" type="password"
                  value={form.password} onChange={handleChange}
                  placeholder="••••••••"
                  required maxLength={128} autoComplete="current-password"
                />
              </div>
            </>
          ) : (
            <div className="input-group">
              <label htmlFor="totpToken">Código do Google Authenticator</label>
              <input
                id="totpToken" name="totpToken" className="input" type="text"
                inputMode="numeric" pattern="[0-9]{6}"
                value={form.totpToken} onChange={handleChange}
                placeholder="000000" required maxLength={6} autoFocus
                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5em' }}
              />
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', marginTop: 4 }}
                onClick={() => setRequires2FA(false)}
              >
                ← Voltar
              </button>
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ marginTop: 8 }}>
            {loading
              ? <><div className="spinner" style={{ width: 18, height: 18 }} /> Entrando...</>
              : 'Entrar'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0', color: 'rgba(255,255,255,.15)', fontSize: 12 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.08)' }} />
          ou
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.08)' }} />
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Não tem conta?{' '}
          <Link to="/cadastro" style={{ color: 'var(--gold2)', fontWeight: 600 }}>Cadastre-se</Link>
        </p>
      </div>
    </div>
  );
}
