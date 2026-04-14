import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Header() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const dropRef = useRef(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handle(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  async function handleLogout() {
    setOpen(false);
    await logout();
    toast.success('Até logo!');
    navigate('/');
  }

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const initials = user?.nickname ? user.nickname.slice(0, 2).toUpperCase() : '??';

  return (
    <>
      <div className="topbar">
        <Link to="/" className="logo-link">BOLÃO<span>MEGA</span></Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isAuthenticated ? (
            <div ref={dropRef} style={{ position: 'relative' }}>
              <div
                className="user-pill"
                onClick={() => setOpen((v) => !v)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setOpen((v) => !v)}
                title="Menu do usuário"
              >
                <div className="avatar">{initials}</div>
                <span>{user?.nickname}</span>
                <span style={{
                  color: 'rgba(255,255,255,.3)', fontSize: 14, marginLeft: 2,
                  display: 'inline-block', transition: 'transform .2s',
                  transform: open ? 'rotate(90deg)' : 'none',
                }}>›</span>
              </div>

              {open && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 12, minWidth: 180, zIndex: 999,
                  boxShadow: '0 8px 32px rgba(0,0,0,.4)',
                  overflow: 'hidden',
                }}>
                  <Link
                    to="/perfil"
                    onClick={() => setOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 16px', color: 'var(--text-primary)',
                      textDecoration: 'none', fontSize: '0.9rem',
                      borderBottom: '1px solid var(--border)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    👤 Meu Perfil
                  </Link>
                  <Link
                    to="/painel"
                    onClick={() => setOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 16px', color: 'var(--text-primary)',
                      textDecoration: 'none', fontSize: '0.9rem',
                      borderBottom: '1px solid var(--border)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    🎯 Minhas Apostas
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '12px 16px',
                      background: 'none', border: 'none',
                      color: 'var(--error)', fontSize: '0.9rem',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,80,80,.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    🚪 Sair
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <Link to="/login"    className="btn btn-ghost"   style={{ padding: '8px 18px', fontSize: 13 }}>Entrar</Link>
              <Link to="/cadastro" className="btn btn-primary" style={{ padding: '8px 18px', fontSize: 13 }}>Cadastrar</Link>
            </div>
          )}
        </div>
      </div>

      <nav className="nav-bar">
        <Link to="/"         className={`nav-tab ${isActive('/')        ? 'active' : ''}`}>Início</Link>
        <Link to="/jogar"    className={`nav-tab ${isActive('/jogar')   ? 'active' : ''}`}>Apostar</Link>
        <Link to="/ranking"  className={`nav-tab ${isActive('/ranking') ? 'active' : ''}`}>Ranking</Link>
        {isAuthenticated && (
          <Link to="/painel" className={`nav-tab ${isActive('/painel') ? 'active' : ''}`}>Minhas Apostas</Link>
        )}
        {isAdmin && (
          <Link to="/admin" className={`nav-tab ${isActive('/admin') ? 'active' : ''}`} style={{ color: isActive('/admin') ? undefined : 'var(--gold)' }}>
            Painel Admin
          </Link>
        )}
      </nav>
    </>
  );
}
