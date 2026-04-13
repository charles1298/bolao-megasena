import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Header() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleLogout() {
    await logout();
    toast.success('Até logo!');
    navigate('/');
  }

  const isActive = (path) =>
    path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(path);

  const initials = user?.nickname
    ? user.nickname.slice(0, 2).toUpperCase()
    : '??';

  return (
    <>
      {/* ── Topbar ── */}
      <div className="topbar">
        <Link to="/" className="logo-link">
          BOLÃO<span>MEGA</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isAuthenticated ? (
            <div
              className="user-pill"
              onClick={handleLogout}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleLogout()}
              title="Clique para sair"
            >
              <div className="avatar">{initials}</div>
              <span>{user?.nickname}</span>
              <span style={{ color: 'rgba(255,255,255,.3)', fontSize: 18, marginLeft: 2 }}>›</span>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <Link to="/login"    className="btn btn-ghost"   style={{ padding: '8px 18px', fontSize: 13 }}>Entrar</Link>
              <Link to="/cadastro" className="btn btn-primary" style={{ padding: '8px 18px', fontSize: 13 }}>Cadastrar</Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Nav tabs ── */}
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
