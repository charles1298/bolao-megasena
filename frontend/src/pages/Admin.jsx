import React, { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

async function downloadCSV(url, filename) {
  try {
    const { data } = await api.get(url, { responseType: 'blob' });
    const href = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(href);
  } catch {
    toast.error('Erro ao exportar CSV.');
  }
}

const TABS = ['Dashboard', 'Jogo', 'Sorteio', 'Cartelas', 'Protocolos', 'Resultado Oficial', 'Usuários', 'Transações', 'Logs', 'Configurações', '2FA'];

export default function Admin() {
  const [tab, setTab] = useState('Dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsTotp, setNeedsTotp] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const { data } = await api.get('/admin/dashboard');
      setDashboard(data);
      setNeedsTotp(false);
    } catch (err) {
      if (err.response?.data?.code === 'TOTP_SETUP_REQUIRED') {
        setNeedsTotp(true);
      } else {
        toast.error('Erro ao carregar dashboard.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  if (needsTotp) {
    return (
      <div className="container" style={{ padding: '40px 20px', maxWidth: 520 }}>
        <div style={{ marginBottom: 24 }}>
          <h2>Painel Administrativo</h2>
        </div>
        <div className="card" style={{ borderColor: 'rgba(229,62,62,.4)', background: 'rgba(229,62,62,.04)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔐</div>
          <h3 style={{ color: 'var(--error)', marginBottom: 8 }}>2FA obrigatório</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.9rem' }}>
            O acesso ao painel administrativo exige autenticação em dois fatores (2FA).
            Configure o Google Authenticator abaixo para continuar.
          </p>
          <TotpTab onActivated={loadDashboard} />
        </div>
      </div>
    );
  }

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
        {tab === 'Jogo'              && <GameTab gameId={dashboard?.activeGame?.id} gameStatus={dashboard?.activeGame?.status} bettingLocked={dashboard?.activeGame?.bettingLocked} onRefresh={loadDashboard} />}
        {tab === 'Sorteio'           && <SorteioTab gameId={dashboard?.activeGame?.id} gameStatus={dashboard?.activeGame?.status} onRefresh={loadDashboard} />}
        {tab === 'Cartelas'          && <TicketsTab gameId={dashboard?.activeGame?.id} />}
        {tab === 'Protocolos'        && <ProtocolsTab gameId={dashboard?.activeGame?.id} />}
        {tab === 'Resultado Oficial' && <ResultadoOficialTab gameId={dashboard?.activeGame?.id} onRefresh={loadDashboard} />}
        {tab === 'Usuários'          && <UsersTab />}
        {tab === 'Transações'        && <TransactionsTab />}
        {tab === 'Logs'              && <LogsTab />}
        {tab === 'Configurações'     && <ConfigTab />}
        {tab === '2FA'               && <TotpTab />}
      </div>
    </div>
  );
}

// ─── Dashboard Tab ──────────────────────────────────────────────────
function DashboardTab({ data, onRefresh }) {
  const [markingPaid, setMarkingPaid] = useState(null);
  if (!data) return null;

  function winnerWaUrl(w) {
    const protocol = w.protocol;
    const prize = Number(w.prizeAmount || 0).toFixed(2).replace('.', ',');
    const msg = `Parabéns ${w.nickname}! 🎉 Você ganhou no GoPremiada!\n\nProtocolo: #${protocol}\nPrêmio: R$ ${prize}\n\nEntre em contato para combinar a entrega do seu prêmio.`;
    const num = (w.whatsapp || '').replace(/\D/g, '');
    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  }

  async function markPrizePaid(w) {
    const prize = Number(w.prizeAmount || 0).toFixed(2).replace('.', ',');
    const notes = window.prompt(
      `Marcar prêmio como pago para ${w.nickname} (R$ ${prize})?\n\n` +
      `Opcional: cole o ID da transação PIX, data e hora, ou observação.`,
      ''
    );
    if (notes === null) return; // cancelou
    setMarkingPaid(w.id);
    try {
      await api.post(`/admin/tickets/${w.id}/prize-paid`, { notes: notes || undefined });
      toast.success('Prêmio marcado como pago.');
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao marcar prêmio.');
    } finally {
      setMarkingPaid(null);
    }
  }

  const allWinners = data.winners || [];
  const winners = allWinners.filter((w) => !w.prizePaidAt); // só os pendentes no alerta

  return (
    <div>
      {/* ── Alerta de ganhadores aguardando contato ── */}
      {winners.length > 0 && (
        <div className="card" style={{
          marginBottom: 24,
          borderColor: 'var(--gold)',
          background: 'linear-gradient(135deg, rgba(212,168,67,.12) 0%, rgba(212,168,67,.04) 100%)',
          boxShadow: '0 0 0 1px rgba(212,168,67,.2), 0 8px 24px rgba(212,168,67,.08)',
          animation: 'fadeIn .4s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 32 }}>🏆</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <h3 style={{ color: 'var(--gold2)', margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem' }}>
                {winners.length} Ganhador{winners.length > 1 ? 'es' : ''} aguardando contato!
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Entre em contato pelo WhatsApp abaixo para combinar a entrega do prêmio.
              </p>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Apostador</th>
                  <th>Protocolo</th>
                  <th>Prêmio</th>
                  <th>WhatsApp</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {winners.map((w) => (
                  <tr key={w.id} style={{ background: 'rgba(212,168,67,.04)' }}>
                    <td style={{ fontWeight: 700 }}>{w.nickname}</td>
                    <td>
                      <code style={{ color: 'var(--gold2)', fontFamily: 'monospace', fontSize: '0.88rem', fontWeight: 700 }}>
                        #{w.protocol}
                      </code>
                    </td>
                    <td style={{ color: 'var(--gold)', fontWeight: 700 }}>
                      {w.prizeAmount != null ? `R$ ${Number(w.prizeAmount).toFixed(2).replace('.', ',')}` : '—'}
                    </td>
                    <td style={{ fontSize: '0.88rem' }}>
                      {w.whatsapp
                        ? <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{w.whatsapp}</span>
                        : <span style={{ color: 'var(--error)', fontSize: '0.8rem' }}>Sem WhatsApp</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {w.whatsapp && (
                          <a
                            href={winnerWaUrl(w)}
                            target="_blank" rel="noreferrer"
                            className="btn btn-primary"
                            style={{ padding: '6px 12px', fontSize: '0.78rem', textDecoration: 'none' }}
                          >
                            📱 Contatar
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => markPrizePaid(w)}
                          disabled={markingPaid === w.id}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                        >
                          {markingPaid === w.id ? '...' : '✓ Marcar pago'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Apostadores" value={data.totalUsers} />
        <StatCard label="Receita total" value={`R$ ${Number(data.totalRevenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="var(--gold)" />
        <StatCard label="Saldo da casa (20%)" value={`R$ ${Number(data.houseCut ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="var(--forest3)" />
        <StatCard label="Pagamentos pendentes" value={data.pendingPayments} color={data.pendingPayments > 0 ? 'var(--warning)' : undefined} />
        <StatCard label="Cartelas ativas" value={data.activeGame?.activeTickets || 0} color="var(--success)" />
        <StatCard label="Ganhadores p/ contatar" value={winners.length} color={winners.length > 0 ? 'var(--gold)' : undefined} />
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
function GameTab({ gameId, gameStatus, bettingLocked, onRefresh }) {
  const [form,       setForm]       = useState({ name: '', startDate: '', autoCloseAt: '' });
  const [draw,       setDraw]       = useState({ numbers: '', drawDate: new Date().toISOString().slice(0, 10) });
  const [loading,    setLoading]    = useState(false);
  const [lockLoading, setLockLoading] = useState(false);
  const [autoClose,  setAutoClose]  = useState('');
  const [acLoading,  setAcLoading]  = useState(false);

  async function toggleLock() {
    if (!gameId) return toast.error('Nenhum jogo ativo.');
    const acao = bettingLocked ? 'abrir' : 'fechar';
    if (!window.confirm(`Confirma ${acao} as apostas?`)) return;
    setLockLoading(true);
    try {
      await api.patch(`/admin/games/${gameId}/betting-lock`);
      toast.success(bettingLocked ? '✅ Apostas abertas!' : '🔒 Apostas fechadas!');
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao alterar apostas.');
    } finally {
      setLockLoading(false);
    }
  }

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

  async function saveAutoClose(e) {
    e.preventDefault();
    if (!gameId) return toast.error('Nenhum jogo ativo.');
    setAcLoading(true);
    try {
      await api.patch(`/admin/games/${gameId}/auto-close`, {
        autoCloseAt: autoClose || null,
      });
      toast.success(autoClose ? `Fechamento automático definido!` : 'Fechamento automático removido.');
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao definir fechamento automático.');
    } finally {
      setAcLoading(false);
    }
  }

  async function createGame(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/admin/games', {
        name: form.name || undefined,
        startDate: form.startDate,
        autoCloseAt: form.autoCloseAt || undefined,
      });
      toast.success('Jogo criado!');
      onRefresh?.();
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

      {/* Controle de apostas */}
      {gameId && gameStatus === 'active' && (
        <div className="card" style={{
          borderColor: bettingLocked ? 'rgba(239,68,68,.4)' : 'rgba(38,168,106,.4)',
          background: bettingLocked ? 'rgba(239,68,68,.04)' : 'rgba(38,168,106,.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h4 style={{ marginBottom: 4, color: bettingLocked ? 'var(--error)' : 'var(--forest3)' }}>
                {bettingLocked ? '🔒 Apostas fechadas' : '✅ Apostas abertas'}
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                {bettingLocked
                  ? 'Ninguém pode fazer novas apostas no momento.'
                  : 'Apostas liberadas. Clique para fechar quando quiser.'}
              </p>
            </div>
            <button
              type="button"
              className={bettingLocked ? 'btn btn-primary' : 'btn btn-danger'}
              onClick={toggleLock}
              disabled={lockLoading}
              style={{ minWidth: 160 }}
            >
              {lockLoading
                ? 'Aguarde...'
                : bettingLocked ? '🔓 Abrir apostas' : '🔒 Fechar apostas'}
            </button>
          </div>
        </div>
      )}

      {/* Fechamento automático de apostas */}
      {gameId && gameStatus === 'active' && (
        <div className="card">
          <h4 style={{ marginBottom: 6 }}>⏰ Fechamento automático de apostas</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 14 }}>
            As apostas serão bloqueadas automaticamente neste horário (ex: 17h do dia do sorteio). Deixe em branco para desativar.
          </p>
          <form onSubmit={saveAutoClose} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="input-group" style={{ margin: 0, flex: 1 }}>
              <label>Data e hora de corte (horário de Brasília)</label>
              <input
                className="input"
                type="datetime-local"
                value={autoClose}
                onChange={(e) => setAutoClose(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={acLoading}>
              {acLoading ? 'Salvando...' : '⏰ Salvar corte'}
            </button>
            {autoClose && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAutoClose(''); }}>
                Limpar
              </button>
            )}
          </form>
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
          <div className="input-group" style={{ margin: 0 }}>
            <label>Fechar apostas automaticamente (opcional)</label>
            <input className="input" type="datetime-local" value={form.autoCloseAt} onChange={e => setForm(p => ({...p, autoCloseAt: e.target.value}))} />
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
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => downloadCSV(`/admin/reports/tickets.csv${gameId ? `?gameId=${gameId}` : ''}`, 'cartelas.csv')}
          >
            📥 Cartelas CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => downloadCSV('/admin/reports/transactions.csv', 'transacoes.csv')}
          >
            📥 Transações CSV
          </button>
        </div>
      </div>

      {/* Zona de perigo — excluir jogo */}
      {gameId && gameStatus !== 'finished' && (
        <div className="card" style={{ borderColor: 'rgba(229,62,62,.35)', background: 'rgba(229,62,62,.04)' }}>
          <h4 style={{ marginBottom: 6, color: 'var(--error)' }}>Zona de perigo</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 16 }}>
            Excluir o jogo remove permanentemente todas as cartelas e pagamentos <strong style={{ color: 'var(--error)' }}>pendentes</strong> associados. Jogos com pagamentos aprovados não podem ser excluídos.
          </p>
          <DeleteGameButton gameId={gameId} gameName="jogo ativo" onDeleted={onRefresh} />
        </div>
      )}
    </div>
  );
}

function DeleteGameButton({ gameId, gameName, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      await api.delete(`/admin/games/${gameId}`);
      toast.success('Jogo excluído com sucesso.');
      setConfirming(false);
      onDeleted?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao excluir jogo.');
    } finally {
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
        🗑 Excluir jogo
      </button>
    );
  }

  return (
    <div style={{ background: 'rgba(229,62,62,.08)', border: '1px solid rgba(229,62,62,.3)', borderRadius: 12, padding: '16px' }}>
      <p style={{ fontWeight: 600, color: 'var(--error)', marginBottom: 8 }}>
        Tem certeza? Esta ação não pode ser desfeita.
      </p>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16 }}>
        Todas as cartelas pendentes e não pagas serão excluídas permanentemente.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={loading}>
          {loading ? 'Excluindo...' : 'Sim, excluir'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)} disabled={loading}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Tickets Tab ───────────────────────────────────────────────────
const STATUS_LABELS = {
  active:          { label: 'Ativa',       cls: 'badge-success' },
  pending_payment: { label: 'Ag. pagamento', cls: 'badge-warning' },
  winner:          { label: 'Ganhadora',   cls: 'badge-warning' },
  cancelled:       { label: 'Cancelada',   cls: 'badge-error' },
};

function TicketsTab({ gameId }) {
  const [data,      setData]      = useState(null);
  const [page,      setPage]      = useState(1);
  const [status,    setStatus]    = useState('');
  const [deleting,  setDeleting]  = useState(null); // id da cartela sendo excluída
  const [approving, setApproving] = useState(null); // id do pagamento sendo aprovado

  function load() {
    const params = new URLSearchParams({ page, limit: 20 });
    if (gameId) params.set('gameId', gameId);
    if (status) params.set('status', status);
    api.get(`/admin/tickets?${params}`)
      .then(({ data }) => setData(data))
      .catch(() => toast.error('Erro ao carregar cartelas.'));
  }

  useEffect(() => { load(); }, [page, status, gameId]);

  async function handleDelete(ticket) {
    if (!window.confirm(
      `Remover cartela de ${ticket.user?.nickname}?\n` +
      `Números: ${ticket.numbers.map(n => String(n).padStart(2,'0')).join(', ')}\n\n` +
      `O pagamento associado será cancelado.`
    )) return;

    setDeleting(ticket.id);
    try {
      await api.delete(`/admin/tickets/${ticket.id}`);
      toast.success('Cartela removida.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao remover cartela.');
    } finally {
      setDeleting(null);
    }
  }

  async function handleApprove(ticket) {
    const paymentId = ticket.payment?.id;
    if (!paymentId) {
      toast.error('Cartela sem pagamento associado.');
      return;
    }
    if (!window.confirm(
      `Aprovar cartela de ${ticket.user?.nickname} SEM confirmação de pagamento?\n\n` +
      `Números: ${ticket.numbers.map(n => String(n).padStart(2,'0')).join(', ')}\n` +
      `Valor: R$ ${Number(ticket.payment?.amount || 0).toFixed(2).replace('.', ',')}\n\n` +
      `Esta ação ativa a cartela e soma o valor ao prêmio do jogo. Use apenas após confirmar o pagamento por fora (PIX manual, transferência etc.).`
    )) return;

    setApproving(paymentId);
    try {
      await api.post(`/admin/payments/${paymentId}/approve`);
      toast.success('Cartela aprovada e ativada.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao aprovar cartela.');
    } finally {
      setApproving(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filtros */}
      <div className="card" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Filtrar por status:</span>
          {['', 'active', 'pending_payment', 'winner'].map((s) => (
            <button
              key={s}
              type="button"
              className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setStatus(s); setPage(1); }}
            >
              {s === '' ? 'Todas' : STATUS_LABELS[s]?.label || s}
            </button>
          ))}
          <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={load} type="button">
            🔄
          </button>
        </div>
      </div>

      {!data ? (
        <div className="loading-overlay"><div className="spinner" /></div>
      ) : (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4>Cartelas ({data.total})</h4>
            {!gameId && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nenhum jogo ativo</span>}
          </div>

          {data.tickets.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
              Nenhuma cartela encontrada.
            </p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Apostador</th>
                    <th>Números</th>
                    <th>Status</th>
                    <th>Pagamento</th>
                    <th>Data</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tickets.map((t) => {
                    const s = STATUS_LABELS[t.status] || { label: t.status, cls: '' };
                    const ps = t.payment?.status;
                    return (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 600 }}>
                          {t.user?.nickname}
                          {t.user?.whatsapp && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                              {t.user.whatsapp}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                            {(t.numbers || []).sort((a, b) => a - b).map((n) => (
                              <span
                                key={n}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  width: 24, height: 24, borderRadius: '50%',
                                  background: 'rgba(212,168,67,.15)',
                                  border: '1px solid rgba(212,168,67,.3)',
                                  color: 'var(--gold)',
                                  fontSize: '0.65rem', fontWeight: 700,
                                }}
                              >
                                {String(n).padStart(2, '0')}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                        <td>
                          <span className={`badge ${
                            ps === 'approved' ? 'badge-success' :
                            ps === 'pending'  ? 'badge-warning' : 'badge-error'
                          }`}>
                            {ps === 'approved' ? 'Pago' : ps === 'pending' ? 'Pendente' : (ps || '—')}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {t.status === 'pending_payment' && ps !== 'approved' && t.payment?.id && (
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                onClick={() => handleApprove(t)}
                                disabled={approving === t.payment.id}
                                title="Aprovar cartela mesmo sem pagamento confirmado"
                              >
                                {approving === t.payment.id ? '...' : '✓ Aprovar'}
                              </button>
                            )}
                            {t.status !== 'winner' && (
                              <button
                                type="button"
                                className="btn btn-danger"
                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                onClick={() => handleDelete(t)}
                                disabled={deleting === t.id}
                              >
                                {deleting === t.id ? '...' : '🗑 Remover'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Pagination page={page} pages={data.pages} onPage={setPage} />
        </div>
      )}
    </div>
  );
}

// ─── Protocolos Tab ────────────────────────────────────────────────
function ProtocolsTab({ gameId }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);

  function load() {
    const params = new URLSearchParams({ page, limit: 100 });
    if (gameId) params.set('gameId', gameId);
    api.get(`/admin/tickets?${params}`)
      .then(({ data }) => setData(data))
      .catch(() => toast.error('Erro ao carregar protocolos.'));
  }

  useEffect(() => { load(); }, [page, gameId]);

  function waUrl(whatsapp, nickname, ticketId, isWinner, prize) {
    const protocol = ticketId.slice(-8).toUpperCase();
    const msg = isWinner
      ? `Parabéns ${nickname}! 🎉 Você ganhou no GoPremiada!\n\nSeu protocolo: #${protocol}\nPrêmio: R$ ${Number(prize || 0).toFixed(2).replace('.', ',')}\n\nEntre em contato para combinar a entrega do seu prêmio.`
      : `Olá ${nickname}! Aqui é o GoPremiada.\n\nSeu protocolo de participação: #${protocol}\n\nQualquer dúvida, estou à disposição!`;
    const num = (whatsapp || '').replace(/\D/g, '');
    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  }

  const paid = (data?.tickets ?? []).filter((t) => t.status === 'active' || t.status === 'winner');
  const winners = paid.filter((t) => t.status === 'winner');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Ganhadores em destaque */}
      {winners.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--gold)', background: 'rgba(212,168,67,.06)' }}>
          <h4 style={{ color: 'var(--gold2)', marginBottom: 16 }}>🏆 Ganhadores — Entre em contato!</h4>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Apostador</th><th>Protocolo</th><th>WhatsApp</th><th>Prêmio</th><th>Contatar</th></tr>
              </thead>
              <tbody>
                {winners.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 700 }}>{t.user?.nickname}</td>
                    <td>
                      <code style={{ color: 'var(--gold2)', fontFamily: 'monospace', fontSize: '0.88rem', fontWeight: 700 }}>
                        #{t.id.slice(-8).toUpperCase()}
                      </code>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.user?.whatsapp || '—'}</td>
                    <td style={{ color: 'var(--gold)', fontWeight: 700 }}>
                      {t.prizeAmount ? `R$ ${Number(t.prizeAmount).toFixed(2).replace('.', ',')}` : '—'}
                    </td>
                    <td>
                      {t.user?.whatsapp ? (
                        <a
                          href={waUrl(t.user.whatsapp, t.user.nickname, t.id, true, t.prizeAmount)}
                          target="_blank" rel="noreferrer"
                          className="btn btn-primary"
                          style={{ padding: '5px 14px', fontSize: '0.82rem' }}
                        >
                          📱 WhatsApp
                        </a>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sem WA</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Todos os participantes com cartela paga */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h4>Participantes com cartela paga ({paid.length})</h4>
          <button className="btn btn-secondary btn-sm" onClick={load} type="button">🔄</button>
        </div>

        {!data ? (
          <div style={{ padding: 32, textAlign: 'center' }}><div className="spinner" /></div>
        ) : paid.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
            Nenhum participante com cartela paga encontrado.
          </p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>#</th><th>Apostador</th><th>Protocolo</th><th>WhatsApp</th><th>Status</th><th>Contatar</th></tr>
              </thead>
              <tbody>
                {paid.map((t, i) => (
                  <tr key={t.id} style={t.status === 'winner' ? { background: 'rgba(212,168,67,.05)' } : undefined}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{t.user?.nickname}</td>
                    <td>
                      <code style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        #{t.id.slice(-8).toUpperCase()}
                      </code>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.user?.whatsapp || '—'}</td>
                    <td>
                      <span className={`badge ${t.status === 'winner' ? 'badge-gold' : 'badge-success'}`}>
                        {t.status === 'winner' ? '🏆 Ganhador' : '✅ Pago'}
                      </span>
                    </td>
                    <td>
                      {t.user?.whatsapp ? (
                        <a
                          href={waUrl(t.user.whatsapp, t.user.nickname, t.id, t.status === 'winner', t.prizeAmount)}
                          target="_blank" rel="noreferrer"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          📱
                        </a>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pages={data?.pages ?? 1} onPage={setPage} />
      </div>

      {!gameId && (
        <div className="card" style={{ borderColor: 'var(--warning)', background: 'rgba(255,193,7,.07)' }}>
          <p style={{ color: 'var(--warning)', margin: 0, fontSize: '0.88rem' }}>
            Exibindo todos os protocolos (nenhum jogo ativo). Para filtrar por jogo, ative um jogo primeiro.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Sorteio Tab ───────────────────────────────────────────────────
function SorteioTab({ gameId, gameStatus, onRefresh }) {
  const [caixaResult, setCaixaResult] = useState(null);
  const [drawResult,  setDrawResult]  = useState(null);
  const [prizeResult, setPrizeResult] = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [manual,      setManual]      = useState('');
  const [drawDate,    setDrawDate]    = useState(new Date().toISOString().slice(0, 10));

  const manualNumbers = manual.split(/[\s,]+/).map(Number).filter((n) => n >= 1 && n <= 60);
  const activeNumbers = caixaResult?.numbers ?? manualNumbers;
  const validNumbers  = activeNumbers.length === 6;
  const isFinished    = gameStatus === 'finished';

  async function buscarDaCaixa() {
    setLoading(true);
    try {
      // Busca direto do browser (sem passar pelo VPS — a Caixa bloqueia IPs de servidor)
      let raw;
      try {
        const res = await fetch(CAIXA_URL, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        raw = await res.json();
      } catch {
        // Fallback: proxy CORS caso o browser também bloqueie
        const res = await fetch(CORS_PROXY + encodeURIComponent(CAIXA_URL));
        if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
        raw = await res.json();
      }
      const data = parseCaixaData(raw);
      setCaixaResult(data);
      if (data.drawDateFormatted) {
        const [d, m, y] = data.drawDateFormatted.split('/');
        if (y) setDrawDate(`${y}-${m}-${d}`);
      }
      setManual('');
    } catch {
      toast.error('Não foi possível buscar o resultado da Caixa. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function processarSorteio() {
    if (!gameId) return toast.error('Nenhum jogo ativo.');
    if (!validNumbers) return toast.error('Selecione 6 números válidos.');
    if (!window.confirm(`Registrar sorteio com os números ${activeNumbers.join(', ')}?\n\nEsta ação irá comparar com todas as cartelas ativas.`)) return;
    setLoading(true);
    try {
      const { data } = await api.post(`/admin/games/${gameId}/draws`, { numbers: activeNumbers, drawDate });
      setDrawResult(data);
      if (data.gameFinished) {
        toast.success(`🏆 Jogo finalizado! ${data.winners} ganhador(es) encontrado(s).`, { duration: 7000 });
      } else {
        toast.success(`Sorteio registrado. Ganhadores: ${data.winners}`);
      }
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao registrar sorteio.');
    } finally {
      setLoading(false);
    }
  }

  async function distribuirPremios() {
    if (!gameId) return;
    if (!window.confirm('Confirmar distribuição de prêmios?\n\nOs valores serão creditados no saldo dos participantes. Esta ação não pode ser desfeita.')) return;
    setLoading(true);
    try {
      const { data } = await api.post(`/admin/games/${gameId}/prizes`);
      setPrizeResult(data);
      toast.success('Prêmios distribuídos com sucesso!');
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao distribuir prêmios.');
    } finally {
      setLoading(false);
    }
  }

  if (!gameId) {
    return (
      <div className="card" style={{ borderColor: 'var(--warning)', background: 'rgba(255,193,7,.07)' }}>
        <p style={{ color: 'var(--warning)', margin: 0 }}>
          Nenhum jogo ativo. Crie e ative um jogo antes de processar o sorteio.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Jogo finalizado — só mostra distribuição */}
      {isFinished && !drawResult && (
        <div className="card" style={{ borderColor: 'var(--gold)', background: 'rgba(212,168,67,.07)', textAlign: 'center', padding: '28px 24px' }}>
          <div style={{ fontSize: '3rem', marginBottom: 8 }}>🏆</div>
          <h3 style={{ color: 'var(--gold2)', marginBottom: 8 }}>Jogo Finalizado — Ganhador Encontrado!</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
            Distribua os prêmios abaixo ou vá para a aba <strong>Protocolos</strong> para contatar o ganhador.
          </p>
        </div>
      )}

      {/* Passo 1 — Resultado da Caixa (oculto se jogo já finalizado sem novo draw) */}
      {(!isFinished || drawResult) && (
        <div className="card">
          <h4 style={{ marginBottom: 4 }}>1. Resultado da Mega Sena</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 16 }}>
            Busque o resultado da Caixa automaticamente ou insira os números manualmente.
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={buscarDaCaixa} disabled={loading}>
              {loading ? 'Buscando...' : '🔍 Buscar resultado da Caixa'}
            </button>
            {caixaResult && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setCaixaResult(null); setManual(''); }} disabled={loading}>
                Limpar
              </button>
            )}
          </div>

          {/* Card com resultado da Caixa */}
          {caixaResult && (
            <div style={{ padding: '16px 20px', background: 'rgba(212,168,67,.06)', border: '1px solid rgba(212,168,67,.25)', borderRadius: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Concurso</div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontWeight: 700, color: 'var(--gold)', lineHeight: 1 }}>
                    #{caixaResult.contestNumber}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Data</div>
                  <div style={{ fontWeight: 600 }}>{caixaResult.drawDateFormatted}</div>
                  {caixaResult.accumulated && (
                    <span className="badge badge-warning" style={{ marginTop: 4, display: 'inline-block' }}>Acumulado</span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                Dezenas sorteadas
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {caixaResult.numbers.map((n) => (
                  <div key={n} className="drawn-ball">{String(n).padStart(2, '0')}</div>
                ))}
              </div>
            </div>
          )}

          {/* Entrada manual (só aparece sem resultado da Caixa) */}
          {!caixaResult && (
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                Ou insira os 6 números manualmente (separados por espaço ou vírgula):
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="input-group" style={{ margin: 0, flex: 1 }}>
                  <input
                    className="input"
                    value={manual}
                    onChange={(e) => setManual(e.target.value)}
                    placeholder="Ex: 4 12 23 34 45 56"
                  />
                </div>
                <div className="input-group" style={{ margin: 0 }}>
                  <label>Data do sorteio</label>
                  <input className="input" type="date" value={drawDate} onChange={(e) => setDrawDate(e.target.value)} />
                </div>
              </div>
              {manualNumbers.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  {manualNumbers.map((n) => (
                    <span key={n} className={`number-ball ${manualNumbers.length === 6 ? 'number-ball-selected' : ''}`}
                      style={{ width: 32, height: 32, fontSize: '0.72rem' }}>
                      {String(n).padStart(2, '0')}
                    </span>
                  ))}
                  {manualNumbers.length !== 6 && (
                    <span style={{ color: 'var(--warning)', fontSize: '0.8rem' }}>
                      {manualNumbers.length}/6 números
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Passo 2 — Processar sorteio */}
      {validNumbers && !drawResult && (
        <div className="card" style={{ borderColor: 'rgba(38,168,106,.35)', background: 'rgba(38,168,106,.04)' }}>
          <h4 style={{ marginBottom: 6, color: 'var(--forest3)' }}>2. Processar Sorteio</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 16 }}>
            Compara os números sorteados com todas as cartelas ativas e verifica se há ganhadores.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={processarSorteio}
              disabled={loading}
              style={{ minWidth: 280 }}
            >
              {loading
                ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Processando...</>
                : '⚡ Registrar Sorteio e Verificar Ganhadores'}
            </button>
            {caixaResult && (
              <div className="input-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.72rem' }}>Data do sorteio</label>
                <input className="input" type="date" value={drawDate} onChange={(e) => setDrawDate(e.target.value)} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Passo 3 — Resultado do sorteio */}
      {drawResult && (
        <>
          {drawResult.winners > 0 ? (
            <div className="card" style={{ borderColor: 'var(--gold)', background: 'rgba(212,168,67,.08)', textAlign: 'center', padding: '28px 24px' }}>
              <div style={{ fontSize: '3rem', marginBottom: 8 }}>🏆</div>
              <h3 style={{ color: 'var(--gold2)', marginBottom: 8 }}>
                {drawResult.winners} Ganhador{drawResult.winners > 1 ? 'es' : ''} Encontrado{drawResult.winners > 1 ? 's' : ''}!
              </h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
                Vá para a aba <strong>Protocolos</strong> para ver os ganhadores e contatá-los pelo WhatsApp.
              </p>
            </div>
          ) : (
            <div className="card">
              <h4 style={{ color: 'var(--forest3)', marginBottom: 12 }}>Sorteio Registrado — Sem Ganhadores</h4>
              <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Ganhadores</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: "'Cormorant Garamond', serif" }}>{drawResult.winners}</div>
                </div>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 14, marginBottom: 0 }}>
                Nenhum ganhador neste concurso. Aguarde o próximo sorteio da Mega Sena.
              </p>
            </div>
          )}
        </>
      )}

      {/* Passo 3/4 — Distribuição de prêmios (jogo finalizado) */}
      {(isFinished || drawResult?.gameFinished) && (
        <div className="card">
          <h4 style={{ marginBottom: 6 }}>{drawResult ? '3.' : ''} Distribuir Prêmios</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 16 }}>
            O sistema calcula a divisão (79% ganhador · 20% casa · 1% gateway). O pagamento ao ganhador é feito por PIX. Esta ação pode ser feita apenas uma vez.
          </p>
          {prizeResult ? (
            <SorteioPrizeCard data={prizeResult} />
          ) : (
            <button type="button" className="btn btn-primary" onClick={distribuirPremios} disabled={loading}>
              {loading ? 'Distribuindo...' : '🏆 Distribuir Prêmios'}
            </button>
          )}
        </div>
      )}

    </div>
  );
}

function SorteioPrizeCard({ data }) {
  const fmt = (v) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const d = data.distribution;
  return (
    <div style={{ background: 'rgba(38,168,106,.06)', border: '1px solid rgba(38,168,106,.25)', borderRadius: 12, padding: '20px' }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
        Divisão calculada
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(212,168,67,.08)', borderRadius: 10 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4 }}>Ganhador ({d.winner.percentage})</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--gold)' }}>
            R$ {fmt(d.winner.perWinner)}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            × {d.winner.winners} ganhador{d.winner.winners > 1 ? 'es' : ''}
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(38,168,106,.07)', borderRadius: 10 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4 }}>Casa ({d.house.percentage})</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--forest3)' }}>
            R$ {fmt(d.house.amount)}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            R$ {fmt(d.house.perOrganizer)} por organizador
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,.04)', borderRadius: 10 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4 }}>Gateway ({d.gateway.percentage})</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            R$ {fmt(d.gateway.amount)}
          </div>
        </div>
      </div>
      <div style={{ paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.07)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Total arrecadado: <strong style={{ color: 'var(--gold2)' }}>R$ {fmt(data.totalPot)}</strong>
        </span>
        <span style={{ color: 'var(--forest3)', fontSize: '0.8rem', fontWeight: 600 }}>
          ✓ Valores calculados — pague o ganhador por PIX
        </span>
      </div>
    </div>
  );
}

// ─── Resultado Oficial Tab ─────────────────────────────────────────
const CAIXA_URL = 'https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena/';
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

function parseCaixaData(data) {
  if (!data?.listaDezenas) throw new Error('Formato inválido.');
  const numbers = data.listaDezenas.map((n) => parseInt(n, 10)).sort((a, b) => a - b);
  const prizes = (data.listaRateioPremio || []).map((p) => ({
    tier: p.descricaoFaixa, winners: p.numeroDeGanhadores, prize: Number(p.valorPremio || 0),
  }));
  return {
    contestNumber: data.numero, drawDateFormatted: data.dataApuracao,
    numbers, accumulated: !!data.acumulado,
    nextPrizeEstimate: Number(data.valorEstimadoProximoConcurso || 0), prizes,
  };
}

function ResultadoOficialTab({ gameId, onRefresh }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  async function buscarResultado() {
    setLoading(true);
    setSyncMsg(null);
    try {
      // Tenta direto do browser (sem o VPS como intermediário)
      let data;
      try {
        const res = await fetch(CAIXA_URL, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
      } catch {
        // Se CORS bloquear, usa proxy
        const res = await fetch(CORS_PROXY + encodeURIComponent(CAIXA_URL));
        if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
        data = await res.json();
      }
      setResult(parseCaixaData(data));
    } catch (err) {
      toast.error('Não foi possível buscar o resultado da Caixa. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function sincronizar() {
    if (!gameId || !result) return toast.error('Busque o resultado primeiro.');
    setLoading(true);
    setSyncMsg(null);
    try {
      // Converte data "dd/MM/yyyy" → "yyyy-MM-dd"
      const [d, m, y] = (result.drawDateFormatted || '').split('/');
      const drawDate = y ? `${y}-${m}-${d}` : new Date().toISOString().slice(0, 10);
      const { data } = await api.post(`/admin/games/${gameId}/draws`, {
        numbers: result.numbers,
        drawDate,
      });
      const msg = data.gameFinished
        ? `🏆 JOGO FINALIZADO! ${data.winners} ganhador(es). Distribua os prêmios.`
        : `Concurso ${result.contestNumber} sincronizado! Ganhadores: ${data.winners}.`;
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
                <label>Nova senha (mín. 8 caracteres, 1 maiúscula, 1 número)</label>
                <input
                  className="input" type="password" value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Nova senha" required minLength={8} autoFocus
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
      {data.payments.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
          Nenhuma transação encontrada.
        </p>
      ) : (
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
      )}
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
      {data.logs.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
          Nenhum log registrado.
        </p>
      ) : (
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
      )}
      <Pagination page={page} pages={data.pages} onPage={setPage} />
    </div>
  );
}

// ─── Configurações Tab (datas do bolão) ────────────────────────────
function ConfigTab() {
  const [form,    setForm]    = useState({ dataInicio: '', dataFechamento: '' });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    api.get('/admin/settings')
      .then(({ data }) => {
        setForm({
          dataInicio:     data.dataInicio     ? toInputValue(data.dataInicio)     : '',
          dataFechamento: data.dataFechamento ? toInputValue(data.dataFechamento) : '',
        });
      })
      .catch(() => toast.error('Erro ao carregar configurações.'))
      .finally(() => setLoading(false));
  }, []);

  function toInputValue(isoStr) {
    // datetime-local exige 'YYYY-MM-DDTHH:MM'
    return isoStr.slice(0, 16);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.dataInicio || !form.dataFechamento) {
      toast.error('Preencha as duas datas.');
      return;
    }
    if (new Date(form.dataFechamento) <= new Date(form.dataInicio)) {
      toast.error('A data de fechamento deve ser após a data de início.');
      return;
    }
    setSaving(true);
    try {
      await api.patch('/admin/settings', {
        dataInicio:     form.dataInicio + ':00',
        dataFechamento: form.dataFechamento + ':00',
      });
      toast.success('Configurações salvas! O banner da home se atualiza automaticamente.');
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading-overlay" style={{ minHeight: 200 }}><div className="spinner" /></div>;

  return (
    <div style={{ maxWidth: 540 }}>
      <div className="card" style={{ borderColor: 'rgba(212,168,67,.3)', background: 'rgba(212,168,67,.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 22 }}>📅</span>
          <div>
            <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: 22 }}>
              Datas do Bolão
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3 }}>
              Essas datas aparecem no banner da página inicial.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>
              🟢 Data de início das apostas
            </label>
            <input
              type="datetime-local"
              className="input"
              value={form.dataInicio}
              onChange={(e) => setForm((f) => ({ ...f, dataInicio: e.target.value }))}
              required
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Texto exibido no banner: "O bolão começa em [esta data]"
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>
              🔴 Data de encerramento das apostas
            </label>
            <input
              type="datetime-local"
              className="input"
              value={form.dataFechamento}
              onChange={(e) => setForm((f) => ({ ...f, dataFechamento: e.target.value }))}
              required
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4 }}>
              O contador regressivo aponta para esta data/hora.
            </div>
          </div>

          {/* Preview */}
          {form.dataInicio && form.dataFechamento && (
            <div style={{
              background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 10, padding: '12px 16px', fontSize: '0.82rem',
            }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: 6, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Preview do banner
              </div>
              <div style={{ color: 'var(--gold)', fontWeight: 600 }}>
                O bolão começa em {new Date(form.dataInicio).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
              <div style={{ color: 'var(--text-muted)', marginTop: 3 }}>
                Apostas encerram em {new Date(form.dataFechamento).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{ alignSelf: 'flex-start', padding: '11px 28px' }}
          >
            {saving ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Salvando...</> : '💾 Salvar datas'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── TOTP Tab ──────────────────────────────────────────────────────
function TotpTab({ onActivated }) {
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
      onActivated?.();
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
