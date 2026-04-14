import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

/* ── Ícones SVG leves ── */
function IconHome({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}
function IconPlay({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8l6 4-6 4V8z" fill={active ? 'currentColor' : 'none'} strokeWidth={active ? 0 : 1.8} />
      {!active && <path d="M10 8l6 4-6 4V8z" />}
    </svg>
  );
}
function IconRanking({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
    </svg>
  );
}
function IconTickets({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M16 5v14M8 9h2M8 12h2M8 15h2" />
    </svg>
  );
}
function IconAdmin({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
    </svg>
  );
}
function IconLogin({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}

export default function Header() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [open, setOpen] = useState(false);
  const dropRef   = useRef(null);

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

  /* ── Itens do bottom nav ── */
  const navItems = [
    { to: '/',        label: 'Início',   Icon: IconHome,    always: true },
    { to: '/jogar',   label: 'Apostar',  Icon: IconPlay,    always: true },
    { to: '/ranking', label: 'Ranking',  Icon: IconRanking, always: true },
    ...(isAuthenticated ? [{ to: '/painel', label: 'Apostas', Icon: IconTickets, always: false }] : []),
    ...(isAdmin        ? [{ to: '/admin',  label: 'Admin',   Icon: IconAdmin,   always: false }] : []),
    ...(!isAuthenticated ? [{ to: '/login', label: 'Entrar', Icon: IconLogin,   always: false }] : []),
  ];

  return (
    <>
      {/* ── Topbar ── */}
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
                <span className="user-pill-name">{user?.nickname}</span>
                <span
                  className="user-pill-arrow"
                  style={{
                    color: 'rgba(255,255,255,.3)', fontSize: 14, marginLeft: 2,
                    display: 'inline-block', transition: 'transform .2s',
                    transform: open ? 'rotate(90deg)' : 'none',
                  }}
                >›</span>
              </div>

              {open && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 12, minWidth: 190, zIndex: 999,
                  boxShadow: '0 8px 32px rgba(0,0,0,.5)',
                  overflow: 'hidden',
                }}>
                  {/* Cabeçalho do menu */}
                  <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,.03)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Logado como</div>
                    <div style={{ fontWeight: 700, color: 'var(--gold2)', fontSize: '0.95rem' }}>{user?.nickname}</div>
                  </div>

                  <DropItem to="/perfil"  onClick={() => setOpen(false)}>👤 Meu Perfil</DropItem>
                  <DropItem to="/painel"  onClick={() => setOpen(false)}>🎯 Minhas Apostas</DropItem>
                  {isAdmin && <DropItem to="/admin" onClick={() => setOpen(false)}>⚙️ Painel Admin</DropItem>}

                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '12px 16px',
                      background: 'none', border: 'none',
                      color: 'var(--error)', fontSize: '0.88rem',
                      cursor: 'pointer', textAlign: 'left',
                      borderTop: '1px solid var(--border)',
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

      {/* ── Nav bar (desktop) ── */}
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

      {/* ── Bottom nav (mobile) ── */}
      <nav className="bottom-nav">
        {navItems.map(({ to, label, Icon }) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              to={to}
              className={`bottom-nav-item${active ? ' active' : ''}`}
            >
              <span className="bottom-nav-icon">
                <Icon active={active} />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function DropItem({ to, onClick, children }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', color: 'var(--text-primary)',
        textDecoration: 'none', fontSize: '0.88rem',
        borderBottom: '1px solid var(--border)',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,.05)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </Link>
  );
}
