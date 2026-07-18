import React from 'react';

// Captura erros de render dos descendentes e mostra uma tela amigável.
// Sem isso, qualquer exceção no React explode em tela branca.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, info: error?.message || 'Erro desconhecido' };
  }

  componentDidCatch(error, errorInfo) {
    // Loga no console pra debug; em produção pode ser enviado a um serviço
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReload = () => {
    // Força reload completo limpando cache do React Router
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        textAlign: 'center',
        background: '#0a1612',
        color: '#faf7f0',
        fontFamily: 'Outfit, system-ui, sans-serif',
      }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>⚠️</div>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: '2rem',
          color: '#d4a843',
          marginBottom: 12,
        }}>
          Ops, algo deu errado
        </h1>
        <p style={{ color: 'rgba(250,247,240,.6)', maxWidth: 480, marginBottom: 28, lineHeight: 1.5 }}>
          Encontramos um problema ao carregar esta página. A equipe foi notificada — tente recarregar.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          style={{
            background: '#d4a843',
            color: '#0a1612',
            border: 'none',
            borderRadius: 12,
            padding: '12px 28px',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(212,168,67,.3)',
          }}
        >
          🔄 Voltar para o início
        </button>
        {this.state.info && (
          <details style={{ marginTop: 32, color: 'rgba(250,247,240,.3)', fontSize: '0.75rem', maxWidth: 600 }}>
            <summary style={{ cursor: 'pointer' }}>Detalhes técnicos</summary>
            <pre style={{ textAlign: 'left', overflow: 'auto', marginTop: 8 }}>{this.state.info}</pre>
          </details>
        )}
      </div>
    );
  }
}
