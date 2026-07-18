import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Particles from './components/Particles';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Play from './pages/Play';
import Admin from './pages/Admin';
import Ranking from './pages/Ranking';
import Profile from './pages/Profile';

function LegalFooter() {
  return (
    <footer className="legal-footer">
      🔞 Exclusivo para maiores de 18 anos &nbsp;·&nbsp;
      Bolão entre participantes — os resultados acompanham o sorteio oficial da Mega Sena (Caixa Econômica Federal) &nbsp;·&nbsp;
      A plataforma não realiza sorteios próprios e não substitui a loteria oficial &nbsp;·&nbsp;
      Jogue com responsabilidade — apostas podem causar dependência. Apoio: <strong style={{ color: 'rgba(250,247,240,0.3)', fontWeight: 600 }}>0800&nbsp;101&nbsp;4101</strong> (Jogadores Anônimos)
    </footer>
  );
}

function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-overlay" style={{ minHeight: '100vh' }}>
        <div className="spinner" style={{ width: 48, height: 48 }} />
      </div>
    );
  }

  return (
    <>
      <Particles />
      <div className="app-root" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Register />} />

            <Route
              path="/jogar"
              element={
                <ProtectedRoute>
                  <Play />
                </ProtectedRoute>
              }
            />
            <Route
              path="/painel"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly>
                  <Admin />
                </ProtectedRoute>
              }
            />

            <Route path="/ranking" element={<Ranking />} />
            <Route
              path="/perfil"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <LegalFooter />
      </div>
    </>
  );
}

export default App;
