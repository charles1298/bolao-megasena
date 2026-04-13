import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate     = useNavigate();

  const [form,    setForm]    = useState({ nickname: '', password: '', confirm: '', whatsapp: '' });
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function validate() {
    if (form.nickname.trim().length < 3)              return 'Apelido deve ter pelo menos 3 caracteres.';
    if (!/^[a-zA-Z0-9_\- ]+$/.test(form.nickname))   return 'Apelido: use apenas letras, números, espaço, _ e -.';
    if (form.password.length < 8)                     return 'Senha deve ter pelo menos 8 caracteres.';
    if (form.password !== form.confirm)               return 'As senhas não coincidem.';
    if (form.whatsapp && !/^\d{10,15}$/.test(form.whatsapp))
      return 'WhatsApp inválido (apenas dígitos, 10-15 caracteres).';
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const err = validate();
    if (err) { toast.error(err); return; }
    setLoading(true);
    try {
      await register(form.nickname.trim(), form.password, form.whatsapp || undefined);
      toast.success('Conta criada! Bem-vindo!');
      navigate('/jogar');
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Erro ao criar conta.');
    } finally {
      setLoading(false);
    }
  }

  const strength = getPasswordStrength(form.password);

  return (
    <div style={{
      minHeight: 'calc(100vh - 110px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div className="card fade-in" style={{ width: '100%', maxWidth: 420, position: 'relative' }}>

        {/* Decoração */}
        <div style={{
          position: 'absolute', top: -40, left: -40,
          width: 160, height: 160, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(38,168,106,.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 36, fontFamily: "'Cormorant Garamond', serif", marginBottom: 6 }}>
            Criar Conta
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Cadastre-se e comece a jogar agora
          </p>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="input-group">
            <label htmlFor="nickname">Apelido *</label>
            <input
              id="nickname" name="nickname" className="input" type="text"
              value={form.nickname} onChange={handleChange}
              placeholder="Seu apelido no bolão"
              required minLength={3} maxLength={30} autoComplete="username"
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Letras, números, espaço, _ ou -
            </span>
          </div>

          <div className="input-group">
            <label htmlFor="password">Senha *</label>
            <input
              id="password" name="password" className="input" type="password"
              value={form.password} onChange={handleChange}
              placeholder="Mínimo 8 caracteres"
              required minLength={8} maxLength={128} autoComplete="new-password"
            />
            {form.password && (
              <div style={{ marginTop: 6 }}>
                <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: `${strength.pct}%`,
                    background: strength.color,
                    transition: 'width .3s, background .3s',
                  }} />
                </div>
                <span style={{ fontSize: '0.72rem', color: strength.color }}>{strength.label}</span>
              </div>
            )}
          </div>

          <div className="input-group">
            <label htmlFor="confirm">Confirmar senha *</label>
            <input
              id="confirm" name="confirm" className="input" type="password"
              value={form.confirm} onChange={handleChange}
              placeholder="Repita a senha"
              required maxLength={128} autoComplete="new-password"
            />
          </div>

          <div className="input-group">
            <label htmlFor="whatsapp">WhatsApp (opcional)</label>
            <input
              id="whatsapp" name="whatsapp" className="input" type="tel"
              value={form.whatsapp} onChange={handleChange}
              placeholder="5511999999999" maxLength={15}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Apenas dígitos com DDI. Usado para contato sobre prêmios.
            </span>
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ marginTop: 8 }}>
            {loading
              ? <><div className="spinner" style={{ width: 18, height: 18 }} /> Criando...</>
              : 'Criar conta'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Já tem conta?{' '}
          <Link to="/login" style={{ color: 'var(--gold2)', fontWeight: 600 }}>Entrar</Link>
        </p>
      </div>
    </div>
  );
}

function getPasswordStrength(password) {
  if (!password) return { pct: 0, label: '', color: 'transparent' };
  let score = 0;
  if (password.length >= 8)          score++;
  if (password.length >= 12)         score++;
  if (/[A-Z]/.test(password))        score++;
  if (/[0-9]/.test(password))        score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { pct: 20,  label: 'Fraca',   color: 'var(--red)' };
  if (score <= 2) return { pct: 40,  label: 'Regular', color: 'var(--warning)' };
  if (score <= 3) return { pct: 65,  label: 'Boa',     color: '#60a5fa' };
  return           { pct: 100, label: 'Forte',   color: 'var(--forest3)' };
}
