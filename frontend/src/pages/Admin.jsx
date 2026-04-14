import React, { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const TABS = ['Dashboard', 'Jogo', 'Resultado Oficial', 'Usuários', 'Transações', 'Logs', '2FA'];

export default function Admin() {
  const [tab, setTab] = useState('Dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const { data } = await api.get('/admin/dashboard');
      setDashboard(data);
    } catch {
      toast.error('Erro ao carregar dashboard.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <div className="container" style={{ padding: '40px 20px' }}>
      <div style={{ marginBottom: 32 }}>
        <h2>Painel Administrativo</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
          Gerencie jogos, apostadores e sorteios.
        </p>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        {tab === 'Dashboard'         && <DashboardTab data={dashboard} onRefresh={loadDashboard} />}
        {tab === 'Jogo'              && <GameTab gameId={dashboard?.activeGame?.id} gameStatus={dashboard?.activeGame?.status} onRefresh={loadDashboard} />}
        {tab === 'Resultado Oficial' && <ResultadoOficialTab gameId={dashboard?.activeGame?.id} onRefresh={loadDashboard} />}
        {tab === 'Usuários'          && <UsersTab />}
        {tab === 'Transações'        && <TransactionsTab />}
        {tab === 'Logs'              && <LogsTab />}
        {tab === '2FA'               && <TotpTab />}
      </div>
    </div>
  );
}

// ─── Dashboard Tab ──────────────────────────────────────────────────
function DashboardTab({ data, onRefresh }) {
  if (!data) return null;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Apostadores" value={data.totalUsers} />
        <StatCard label="Receita total" value={`R$ ${Number(data.totalRevenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="var(--gold)" />
        <StatCard label="Saldo da casa (20%)" value={`R$ ${Number(data.houseCut ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="var(--forest3)" />
        <StatCard label="Pagamentos pendentes" value={data.pendingPayments} color={data.pendingPayments > 0 ? 'var(--warning)' : undefined} />
        <StatCard label="Cartelas ativas" value={data.activeGame?.activeTickets || 0} color="var(--success)" />
      </div>

      {data.activeGame && (
        <div className="card">
          <h4 style={{ marginBottom: 16 }}>Jogo ativo</h4>
          <div className="grid-3">
            <Info label="Nome" value={data.activeGame.name} />
            <Info label="Status" value={data.activeGame.status} />
            <Info label="Sorteios realizados" value={data.activeGame.drawCount} />
          </div>
        </div>
      )}

      <button className="btn btn-secondary btn-sm" style={{ marginTop: 16 }} onClick={onRefresh} type="button">
        🔄 Atualizar
      </button>
    </div>
  );
}

// ─── Game Tab ──────────────────────────────────────────────────────
function GameTab({ gameId, gameStatus, onRefresh }) {
  const [form, setForm] = useState({ name: '', startDate: '' });
  const [draw, setDraw] = useState({ numbers: '', drawDate: new Date().toISOString().slice(0, 10) });
  const [loading, setLoading] = useState(false);

  async function activateGame() {
    if (!gameId) return toast.error('Nenhum jogo encontrado.');
    if (!window.confirm('Ativar este jogo?')) return;
    setLoading(true);
    try {
      await api.patch(`/admin/games/${gameId}/activate`);
      toast.success('Jogo ativado com sucesso!');
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao ativar jogo.');
    } finally {
      setLoading(false);
    }
  }

  async function createGame(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/admin/games', {
        name: form.name || undefined,
        startDate: form.startDate,
      });
      toast.success('Jogo criado!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar jogo.');
    } finally {
      setLoading(false);
    }
  }

  async function registerDraw(e) {
    e.preventDefault();
    if (!gameId) return toast.error('Sem jogo ativo.');
    const nums = draw.numbers.split(/[\s,]+/).map(Number).filter(n => n >= 1 && n <= 60);
    if (nums.length !== 6) return toast.error('Informe 6 números válidos.');

    setLoading(true);
    try {
      const { data } = await api.post(`/admin/games/${gameId}/draws`, {
        numbers: nums,
        drawDate: draw.drawDate,
      });
      toast.success(`Sorteio registrado! Ganhadores: ${data.winners}`);
      if (data.gameFinished) toast.success('🏆 JOGO FINALIZADO! Distribua os prêmios.', { duration: 6000 });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao registrar sorteio.');
    } finally {
      setLoading(false);
    }
  }

  async function processPrizes() {
    if (!gameId) return toast.error('Sem jogo ativo.');
    if (!window.confirm('Confirmar distribuição de prêmios? Esta ação não pode ser desfeita.')) return;
    setLoading(true);
    try {
      const { data } = await api.post(`/admin/games/${gameId}/prizes`);
      toast.success(`Prêmios distribuídos! Total: R$ ${data.totalPot}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao distribuir prêmios.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Ativar jogo pendente */}
      {gameId && gameStatus === 'pending' && (
        <div className="card" style={{ borderColor: 'var(--warning)', background: 'rgba(255,193,7,.05)' }}>
          <h4 style={{ marginBottom: 8, color: 'var(--warning)' }}>Jogo pendente — aguardando ativação</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 16 }}>
            O jogo existe mas ainda está pendente. Clique para ativá-lo e liberar apostas.
          </p>
          <button type="button" className="btn btn-primary" onClick={activateGame} disabled={loading}>
            ▶ Ativar jogo agora
          </button>
        </div>
      )}

      {/* Criar jogo */}
      <div className="card">
        <h4 style={{ marginBottom: 16 }}>Criar novo jogo</h4>
        <form onSubmit={createGame} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="input-group" style={{ margin: 0, flex: 1 }}>
            <label>Nome do jogo (opcional)</label>
            <input className="input" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="Bolão Mega Sena" />
          </div>
          <div className="input-group" style={{ margin: 0 }}>
            <label>Data de início *</label>
            <input className="input" type="datetime-local" value={form.startDate} onChange={e => setForm(p => ({...p, startDate: e.target.value}))} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>Criar jogo</button>
        </form>
      </div>

      {/* Registrar sorteio */}
      {gameId && (
        <div className="card">
          <h4 style={{ marginBottom: 16 }}>Registrar resultado da Mega Sena</h4>
          <form onSubmit={registerDraw} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="input-group" style={{ margin: 0, flex: 1 }}>
              <label>Números sorteados (separados por espaço ou vírgula)</label>
              <input
                className="input"
                value={draw.numbers}
                onChange={e => setDraw(p => ({...p, numbers: e.target.value}))}
                placeholder="Ex: 4 12 23 34 45 56"
                required
              />
            </div>
            <div className="input-group" style={{ margin: 0 }}>
              <label>Data do sorteio</label>
              <input className="input" type="date" value={draw.drawDate} onChange={e => setDraw(p => ({...p, drawDate: e.target.value}))} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>Registrar</button>
          </form>
        </div>
      )}

      {/* Distribuir prêmios */}
      {gameId && (
        <div className="card">
          <h4 style={{ marginBottom: 8 }}>Distribuir prêmios</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 16 }}>
            Use apenas após o jogo ser finalizado (ganhador encontrado).
          </p>
          <button type="button" className="btn btn-primary" onClick={processPrizes} disabled={loading}>
            🏆 Processar prêmios
          </button>
        </div>
      )}

      {/* Exportações */}
      <div className="card">
        <h4 style={{ marginBottom: 16 }}>Exportar relatórios</h4>
        <div style={{ display: 'flex', gap: 12 }}>
          <a
            href={`/api/admin/reports/tickets.csv${gameId ? `?gameId=${gameId}` : ''}`}
            className="btn btn-secondary btn-sm"
            download
          >
            📥 Cartelas CSV
          </a>
          <a href="/api/admin/reports/transactions.csv" className="btn btn-secondary btn-sm" download>
            📥 Transações CSV
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Resultado Oficial Tab ─────────────────────────────────────────
function ResultadoOficialTab({ gameId, onRefresh }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  async function buscarResultado() {
    setLoading(true);
    setSyncMsg(null);
    try {
      const { data } = await api.get('/admin/mega-sena/latest');
      setResult(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao buscar resultado da Caixa.');
    } finally {
      setLoading(false);
    }
  }

  async function sincronizar() {
    if (!gameId) return toast.error('Sem jogo ativo para sincronizar.');
    setLoading(true);
    setSyncMsg(null);
    try {
      const { data } = await api.post('/admin/mega-sena/sync');
      const msg = data.gameFinished
        ? `🏆 JOGO FINALIZADO! ${data.winners} ganhador(es). Distribua os prêmios.`
        : `Concurso ${data.official.contestNumber} sincronizado! Ganhadores: ${data.winners}, Pé quente: ${data.peQuente}, Pé frio: ${data.peFrio}.`;
      setSyncMsg({ type: 'success', text: msg });
      toast.success('Sorteio sincronizado!');
      if (data.gameFinished) toast.success('🏆 JOGO FINALIZADO! Distribua os prêmios.', { duration: 7000 });
      onRefresh();
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Erro ao sincronizar.';
      setSyncMsg({ type: 'error', text: errMsg });
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Buscar resultado */}
      <div className="card">
        <h4 style={{ marginBottom: 8 }}>Último Resultado Oficial da Mega Sena</h4>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 16 }}>
          Busca o resultado diretamente da API pública da Caixa Econômica Federal.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={buscarResultado} disabled={loading}>
            {loading ? 'Buscando...' : '🔍 Buscar resultado da Caixa'}
          </button>
          {result && gameId && (
            <button type="button" className="btn btn-primary" onClick={sincronizar} disabled={loading}>
              {loading ? 'Sincronizando...' : '⚡ Sincronizar com jogo ativo'}
            </button>
          )}
        </div>
      </div>

      {/* Card de resultado */}
      {result && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Concurso</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontWeight: 700, color: 'var(--gold)', lineHeight: 1 }}>
                #{result.contestNumber}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Data</div>
              <div style={{ fontWeight: 600 }}>{result.drawDateFormatted}</div>
              {result.accumulated && (
                <span className="badge badge-warning" style={{ marginTop: 4, display: 'inline-block' }}>Acumulado</span>
              )}
            </div>
          </div>

          {/* Dezenas sorteadas */}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Dezenas sorteadas
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            {result.numbers.map((n) => (
              <div key={n} className="drawn-ball" style={{ animationDelay: `${result.numbers.indexOf(n) * 0.08}s` }}>
                {String(n).padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* Prêmios */}
          {result.prizes?.length > 0 && (
            <>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Prêmios oficiais
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Faixa</th><th>Ganhadores</th><th>Prêmio individual</th></tr>
                  </thead>
                  <tbody>
                    {result.prizes.map((p, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{p.tier}</td>
                        <td>{p.winners}</td>
                        <td style={{ color: p.prize > 0 ? 'var(--gold)' : 'var(--text-muted)' }}>
                          {p.prize > 0
                            ? `R$ ${Number(p.prize).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.nextPrizeEstimate > 0 && (
                <p style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Estimativa próximo concurso:{' '}
                  <strong style={{ color: 'var(--gold)' }}>
                    R$ {Number(result.nextPrizeEstimate).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Feedback de sincronização */}
      {syncMsg && (
        <div className="card" style={{
          borderColor: syncMsg.type === 'success' ? 'var(--forest3)' : 'var(--error)',
          background: syncMsg.type === 'success' ? 'rgba(38,168,106,.07)' : 'rgba(255,80,80,.07)',
        }}>
          <p style={{ color: syncMsg.type === 'success' ? 'var(--forest3)' : 'var(--error)', margin: 0 }}>
            {syncMsg.text}
          </p>
        </div>
      )}

      {!gameId && (
        <div className="card" style={{ borderColor: 'var(--warning)', background: 'rgba(255,193,7,.07)' }}>
          <p style={{ color: 'var(--warning)', margin: 0 }}>
            Nenhum jogo ativo. Crie e ative um jogo antes de sincronizar resultados.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Users Tab ─────────────────────────────────────────────────────
function UsersTab() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [resetTarget, setResetTarget] = useState(null); // { id, nickname }
  const [newPass, setNewPass] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    api.get(`/admin/users?page=${page}&limit=20`)
      .then(({ data }) => setData(data))
      .catch(() => toast.error('Erro ao carregar usuários.'));
  }, [page]);

  async function handleReset(e) {
    e.preventDefault();
    setResetting(true);
    try {
      await api.post(`/admin/users/${resetTarget.id}/reset-password`, { newPassword: newPass });
      toast.success(`Senha de ${resetTarget.nickname} redefinida!`);
      setResetTarget(null);
      setNewPass('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao redefinir.');
    } finally {
      setResetting(false);
    }
  }

  if (!data) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h4>Usuários ({data.total})</h4>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Apelido</th><th>WhatsApp</th><th>Cartelas</th><th>Cadastro</th><th>Status</th><th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.nickname}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{u.whatsapp || '—'}</td>
                  <td>{u._count.tickets}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(u.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td><span className={`badge ${u.isActive ? 'badge-success' : 'badge-error'}`}>{u.isActive ? 'Ativo' : 'Bloqueado'}</span></td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      onClick={() => { setResetTarget(u); setNewPass(''); }}
                      type="button"
                    >
                      🔑 Senha
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={data.pages} onPage={setPage} />
      </div>

      {/* Modal reset senha */}
      {resetTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div className="card" style={{ maxWidth: 360, width: '100%' }}>
            <h4 style={{ marginBottom: 8 }}>Redefinir senha</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 20 }}>
              Usuário: <strong style={{ color: 'var(--gold2)' }}>{resetTarget.nickname}</strong>
            </p>
            <form onSubmit={handleReset}>
              <div className="input-group">
                <label>Nova senha (mín. 6 caracteres)</label>
                <input
                  className="input" type="text" value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Nova senha" required minLength={6} autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn btn-primary" disabled={resetting}>
                  {resetting ? 'Salvando...' : 'Redefinir'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setResetTarget(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Transactions Tab ──────────────────────────────────────────────
function TransactionsTab() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [approving, setApproving] = useState(null);

  function load() {
    api.get(`/admin/transactions?page=${page}&limit=20`)
      .then(({ data }) => setData(data))
      .catch(() => toast.error('Erro ao carregar transações.'));
  }

  useEffect(() => { load(); }, [page]);

  async function approve(paymentId) {
    if (!window.confirm('Confirmar aprovação manual deste pagamento?')) return;
    setApproving(paymentId);
    try {
      await api.post(`/admin/payments/${paymentId}/approve`);
      toast.success('Pagamento aprovado e cartela ativada!');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao aprovar.');
    } finally {
      setApproving(null);
    }
  }

  if (!data) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h4>Transações ({data.total})</h4>
        <button className="btn btn-secondary btn-sm" onClick={load} type="button">🔄 Atualizar</button>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Usuário</th><th>Valor</th><th>Status</th><th>Data</th><th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {data.payments.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.ticket?.user?.nickname || '—'}</td>
                <td style={{ fontWeight: 600 }}>R$ {Number(p.amount).toFixed(2)}</td>
                <td>
                  <span className={`badge ${p.status === 'approved' ? 'badge-success' : p.status === 'pending' ? 'badge-warning' : 'badge-error'}`}>
                    {p.status}
                  </span>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(p.createdAt).toLocaleDateString('pt-BR')}</td>
                <td>
                  {p.status === 'pending' && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => approve(p.id)}
                      disabled={approving === p.id}
                      type="button"
                      style={{ padding: '4px 12px', fontSize: '0.78rem' }}
                    >
                      {approving === p.id ? '...' : '✓ Aprovar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={data.pages} onPage={setPage} />
    </div>
  );
}

// ─── Logs Tab ─────────────────────────────────────────────────────
function LogsTab() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get(`/admin/logs?page=${page}&limit=50`)
      .then(({ data }) => setData(data))
      .catch(() => toast.error('Erro ao carregar logs.'));
  }, [page]);

  if (!data) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <div className="card">
      <h4 style={{ marginBottom: 16 }}>Log de ações ({data.total})</h4>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>Ação</th><th>Admin</th><th>IP</th><th>Data/Hora</th></tr>
          </thead>
          <tbody>
            {data.logs.map((l) => (
              <tr key={l.id}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{l.action}</td>
                <td>{l.admin?.nickname}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{l.ipAddress || '—'}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(l.createdAt).toLocaleString('pt-BR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={data.pages} onPage={setPage} />
    </div>
  );
}

// ─── TOTP Tab ──────────────────────────────────────────────────────
function TotpTab() {
  const [qrData, setQrData] = useState(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  async function setup() {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/totp/setup');
      setQrData(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro no setup 2FA.');
    } finally {
      setLoading(false);
    }
  }

  async function confirm(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/admin/totp/confirm', { token });
      toast.success('2FA ativado com sucesso!');
      setQrData(null);
      setToken('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Código inválido.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h4 style={{ marginBottom: 8 }}>Autenticação em 2 Fatores (TOTP)</h4>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 24 }}>
        Ative o 2FA para proteger o painel administrativo com Google Authenticator.
      </p>

      {!qrData ? (
        <button type="button" className="btn btn-primary" onClick={setup} disabled={loading}>
          {loading ? 'Gerando...' : '🔐 Gerar QR Code 2FA'}
        </button>
      ) : (
        <div>
          <p style={{ marginBottom: 16, fontSize: '0.875rem' }}>
            1. Escaneie o QR Code com o Google Authenticator.<br />
            2. Digite o código gerado abaixo para confirmar.
          </p>
          <img src={qrData.qrCodeDataUrl} alt="QR Code 2FA" style={{ borderRadius: 8, marginBottom: 20 }} />
          <form onSubmit={confirm}>
            <div className="input-group">
              <label>Código de confirmação (6 dígitos)</label>
              <input
                className="input"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="000000"
                maxLength={6}
                pattern="[0-9]{6}"
                inputMode="numeric"
                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5em' }}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Verificando...' : 'Ativar 2FA'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── Shared components ─────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: color || 'var(--text-primary)', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
      <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} type="button">←</button>
      <span style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{page} / {pages}</span>
      <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} type="button">→</button>
    </div>
  );
}

const styles = {
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
};
