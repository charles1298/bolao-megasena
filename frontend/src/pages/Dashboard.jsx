import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import TicketCard from '../components/TicketCard';
import toast from 'react-hot-toast';

const FILTERS = [
  { key: 'all',     label: 'Todas' },
  { key: 'active',  label: 'Ativas' },
  { key: 'pending', label: 'Aguardando pagamento' },
  { key: 'winner',  label: '🏆 Ganhadoras' },
];

export default function Dashboard() {
  const { user }                  = useAuth();
  const [tickets,  setTickets]    = useState([]);
  const [stats,    setStats]      = useState(null);
  const [loading,  setLoading]    = useState(true);
  const [filter,   setFilter]     = useState('all');

  useEffect(() => {
    Promise.all([api.get('/game/tickets/my'), api.get('/users/me/stats')])
      .then(([t, s]) => { setTickets(t.data); setStats(s.data); })
      .catch(() => toast.error('Erro ao carregar dados.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = tickets.filter((t) => {
    if (filter === 'active')  return t.status === 'active';
    if (filter === 'pending') return t.status === 'pending_payment';
    if (filter === 'winner')  return t.status === 'winner';
    return true;
  });

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <div className="container" style={{ padding: '2.5rem 24px 4rem' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>
            Minhas <span>Apostas</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Olá, <strong style={{ color: 'var(--gold2)' }}>{user?.nickname}</strong>! Aqui estão suas cartelas.
          </p>
        </div>
        <Link to="/jogar" className="btn btn-primary" style={{ padding: '12px 22px', fontSize: 14 }}>
          + Nova aposta
        </Link>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 32 }}>
          <StatCard label="Total de cartelas" value={stats.totalTickets} />
          <StatCard label="Cartelas ativas"   value={stats.activeTickets} accent="var(--forest3)" />
          <StatCard
            label="Melhor acerto"
            value={`${stats.bestHits ?? 0} / 6`}
            accent={stats.bestHits >= 4 ? 'var(--gold2)' : undefined}
          />
          <StatCard
            label="Investido"
            value={`R$ ${Number(stats.totalSpent).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          />
          <StatCard
            label="Prêmios ganhos"
            value={`R$ ${Number(stats.totalPrize).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            accent={Number(stats.totalPrize) > 0 ? 'var(--gold2)' : undefined}
          />
          <StatCard
            label="Saldo em conta"
            value={`R$ ${Number(stats.balance ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            accent={Number(stats.balance) > 0 ? 'var(--forest3)' : undefined}
          />
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Cartelas */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
            {filter === 'all'
              ? 'Você ainda não tem cartelas. Faça sua primeira aposta!'
              : 'Nenhuma cartela nesta categoria.'}
          </p>
          {filter === 'all' && (
            <Link to="/jogar" className="btn btn-primary" style={{ marginTop: 20, display: 'inline-flex' }}>
              Jogar agora
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {filtered.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: '1.9rem',
        fontWeight: 700,
        color: accent ?? 'var(--cream)',
        marginBottom: 4,
        animation: 'countUp .4s ease',
      }}>
        {value}
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  );
}
