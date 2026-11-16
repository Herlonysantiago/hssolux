import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AlertCircle, Bell, CalendarDays, Check, ChevronDown, CircleDollarSign, Clock3, FileText, Filter, LayoutDashboard, LogOut, Menu, MoreHorizontal, Plus, ReceiptText, Search, Settings, Users, WalletCards, X } from 'lucide-react'
import { canEdit, effectiveStatus, formatMoney, summarize } from './domain'
import { changeMemberRole, configured, createSpace, inviteToSpace, loadAccounts, loadSpaceAccess, loadWorkspace, markPaid, removeSpaceMember, saveAccount, signIn, signInWithGoogle, signUp, softDeleteAccount, supabase } from './supabase'
import type { Account, AccountDraft, Plan, Space } from './types'

const emptyDraft: AccountDraft = { direcao: 'PAGAR', fornecedor: '', valor: '', vencimento: new Date().toISOString().slice(0, 10), categoria: 'Outros', subcategoria: '', responsavel: '', codigo: '', banco: '', recorrente: false, recorrencia: 'Mensal' }
const nav = [
  ['Dashboard', LayoutDashboard], ['Hoje', Clock3], ['Contas', WalletCards], ['Calendário', CalendarDays],
  ['Relatórios', FileText], ['Alertas', Bell], ['Espaços', Users], ['Planos', CircleDollarSign],
] as const

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loadingSession, setLoadingSession] = useState(configured)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoadingSession(false) })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])
  if (loadingSession) return <Splash />
  if (!session) return <AuthScreen />
  return <Panel session={session} />
}

function Splash() { return <div className="splash"><div className="brand-mark">HS</div><span>Carregando seu HS Cash…</span></div> }

function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('')
    try {
      if (mode === 'login') await signIn(email, password)
      else { await signUp(email, password, name); setMessage('Cadastro realizado. Confira seu e-mail para confirmar o acesso.') }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível entrar.') }
    finally { setBusy(false) }
  }
  async function google() {
    setBusy(true); setMessage('')
    try { await signInWithGoogle() } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível iniciar o acesso com Google.'); setBusy(false) }
  }
  return <main className="auth-shell">
    <section className="auth-hero">
      <div className="auth-brand"><div className="brand-mark">HS</div><div><b>HS Cash</b><span>Controle financeiro simples</span></div></div>
      <div className="hero-copy"><span className="eyebrow">SEU DINHEIRO, ORGANIZADO</span><h1>Clareza para decidir.<br/><em>Controle para crescer.</em></h1><p>Contas a pagar e receber, vencimentos e espaços compartilhados em um painel seguro.</p></div>
      <div className="hero-orb"><WalletCards size={78}/></div>
      <footer>HS Solux · Segurança e simplicidade para sua rotina</footer>
    </section>
    <section className="auth-card-wrap"><form className="auth-card" onSubmit={submit}>
      <div className="mobile-brand"><div className="brand-mark">HS</div><b>HS Cash</b></div>
      <h2>{mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}</h2><p>{mode === 'login' ? 'Entre para acessar seu painel financeiro.' : 'Comece no plano Grátis, sem cobrança.'}</p>
      {!configured && <div className="notice"><AlertCircle size={18}/><span>Supabase ainda não configurado. Copie <b>.env.example</b> para <b>.env.local</b>.</span></div>}
      {mode === 'signup' && <label>Nome completo<input value={name} onChange={(e) => setName(e.target.value)} required /></label>}
      <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" required /></label>
      <label>Senha<input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></label>
      {message && <div className="form-message">{message}</div>}
      <button className="primary full" disabled={busy || !configured}>{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar no HS Cash' : 'Criar conta'}</button>
      {mode === 'login' && <><div className="or-divider"><span>ou</span></div><button type="button" className="google-button" disabled={busy || !configured} onClick={google}><span className="google-g">G</span>Continuar com Google</button></>}
      <button type="button" className="link-button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}>{mode === 'login' ? 'Ainda não tem conta? Criar agora' : 'Já tem conta? Entrar'}</button>
    </form></section>
  </main>
}

function Panel({ session }: { session: Session }) {
  const [spaces, setSpaces] = useState<Space[]>([]), [spaceId, setSpaceId] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([]), [plan, setPlan] = useState<Plan>('FREE')
  const [name, setName] = useState(session.user.email || 'Usuário'), [active, setActive] = useState('Dashboard')
  const [busy, setBusy] = useState(true), [error, setError] = useState(''), [mobileMenu, setMobileMenu] = useState(false)
  const [modal, setModal] = useState(false), [editing, setEditing] = useState<Account | null>(null)
  const current = spaces.find((space) => space.id === spaceId)
  async function refreshAccounts(selected = spaceId) { if (!selected) return; setAccounts(await loadAccounts(selected)) }
  useEffect(() => { loadWorkspace(session).then((data) => { setSpaces(data.spaces); setPlan(data.plan); setName(data.name); const first = data.spaces[0]?.id ?? ''; setSpaceId(first); return first ? loadAccounts(first) : [] }).then(setAccounts).catch((e) => setError(e.message)).finally(() => setBusy(false)) }, [session])
  useEffect(() => { if (spaceId) refreshAccounts(spaceId).catch((e) => setError(e.message)) }, [spaceId])
  const visibleAccounts = accounts.filter((a) => !a.deleted_at)
  const totals = summarize(visibleAccounts)
  function openNew() { setEditing(null); setModal(true) }
  function openEdit(account: Account) { setEditing(account); setModal(true) }
  async function paid(account: Account) { if (!current || !canEdit(current.role)) return; try { await markPaid(account, name); await refreshAccounts() } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao atualizar') } }
  if (busy) return <Splash />
  return <div className="app-shell">
    <aside className={mobileMenu ? 'sidebar open' : 'sidebar'}>
      <div className="side-brand"><div className="brand-mark">HS</div><div><b>HS Cash</b><span>Gestão financeira</span></div><button className="icon-button mobile-only" onClick={() => setMobileMenu(false)}><X/></button></div>
      <div className="space-switcher"><span>ESPAÇO ATUAL</span><button><i style={{ background: current?.cor || '#27c3a5' }}><WalletCards size={18}/></i><div><b>{current?.nome || 'Sem espaço'}</b><small>{current?.tipo?.toLowerCase() || 'crie seu primeiro espaço'}</small></div><ChevronDown size={16}/></button></div>
      <nav>{nav.map(([label, Icon]) => <button key={label} className={active === label ? 'active' : ''} onClick={() => { setActive(label); setMobileMenu(false) }}><Icon size={19}/>{label}{label === 'Alertas' && visibleAccounts.some((a) => effectiveStatus(a) === 'ATRASADO') && <i className="nav-dot"/>}</button>)}</nav>
      <div className="side-bottom"><div className="plan-chip"><span>PLANO {plan}</span><small>{plan === 'FREE' ? `${spaces.length} de 2 espaços` : plan === 'PRO' ? `${spaces.length} de 10 espaços` : 'Espaços ilimitados'}</small><div><i style={{ width: `${plan === 'FREE' ? Math.min(spaces.length / 2 * 100, 100) : plan === 'PRO' ? Math.min(spaces.length / 10 * 100, 100) : 100}%` }}/></div></div><button><Settings size={18}/>Configurações</button><button onClick={() => supabase?.auth.signOut()}><LogOut size={18}/>Sair</button></div>
    </aside>
    <main className="workspace">
      <header><button className="icon-button menu-button" onClick={() => setMobileMenu(true)}><Menu/></button><div className="search"><Search size={18}/><input placeholder="Buscar em contas, fornecedores…" /></div><button className="icon-button"><Bell size={20}/></button><div className="avatar">{name.slice(0, 2).toUpperCase()}</div><div className="user-meta"><b>{name}</b><span>{current?.role || 'Sem acesso'}</span></div></header>
      {error && <div className="error-banner"><AlertCircle size={18}/>{error}<button onClick={() => setError('')}><X size={16}/></button></div>}
      <section className="content">
        <div className="page-title"><div><span className="eyebrow">VISÃO GERAL</span><h1>{active}</h1><p>{active === 'Dashboard' ? `Olá, ${name.split(' ')[0]}. Aqui está o resumo do seu espaço.` : 'Módulo preparado para a próxima etapa incremental.'}</p></div>{current && canEdit(current.role) && <button className="primary" onClick={openNew}><Plus size={18}/>Nova conta</button>}</div>
        {active === 'Dashboard' ? <Dashboard accounts={visibleAccounts} totals={totals} onPaid={paid} onEdit={openEdit} editable={Boolean(current && canEdit(current.role))} /> : active === 'Contas' ? <Accounts accounts={visibleAccounts} editable={Boolean(current && canEdit(current.role))} onPaid={paid} onEdit={openEdit} /> : active === 'Espaços' ? <SpacesManager spaces={spaces} plan={plan} selectedId={spaceId} currentRole={current?.role || 'VIEWER'} userId={session.user.id} onSelect={setSpaceId} onCreated={async () => { const data = await loadWorkspace(session); setSpaces(data.spaces); setPlan(data.plan); setSpaceId(data.spaces.at(-1)?.id || spaceId) }} /> : <ModulePlaceholder name={active} />}
      </section>
    </main>
    {modal && current && <AccountModal account={editing} spaceId={current.id} onClose={() => setModal(false)} onSaved={async () => { setModal(false); await refreshAccounts() }} onDelete={editing ? async () => { await softDeleteAccount(editing.id); setModal(false); await refreshAccounts() } : undefined} />}
  </div>
}

function Dashboard({ accounts, totals, editable, onPaid, onEdit }: { accounts: Account[]; totals: ReturnType<typeof summarize>; editable: boolean; onPaid: (a: Account) => void; onEdit: (a: Account) => void }) {
  const upcoming = [...accounts].filter((a) => a.status !== 'PAGO').sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 6)
  return <><div className="metric-grid"><Metric label="A pagar" value={formatMoney(totals.toPay)} hint="Em aberto" tone="navy" icon={<ReceiptText/>}/><Metric label="A receber" value={formatMoney(totals.toReceive)} hint="Previsto" tone="green" icon={<CircleDollarSign/>}/><Metric label="Em atraso" value={formatMoney(totals.overdue)} hint="Requer atenção" tone="red" icon={<AlertCircle/>}/><Metric label="Total pago" value={formatMoney(totals.paid)} hint="No período" tone="blue" icon={<Check/>}/></div><div className="dashboard-grid"><section className="panel recent"><div className="panel-head"><div><h2>Próximos vencimentos</h2><p>Contas abertas ordenadas por data</p></div><button className="ghost">Ver todas</button></div><AccountTable accounts={upcoming} editable={editable} onPaid={onPaid} onEdit={onEdit}/></section><section className="panel distribution"><div className="panel-head"><div><h2>Distribuição</h2><p>Contas abertas</p></div></div><Donut accounts={accounts}/></section></div></>
}

function Metric({ label, value, hint, tone, icon }: { label: string; value: string; hint: string; tone: string; icon: React.ReactNode }) { return <article className={`metric ${tone}`}><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{hint}</small></article> }

function Donut({ accounts }: { accounts: Account[] }) {
  const open = accounts.filter((a) => a.status !== 'PAGO'), pay = open.filter((a) => a.direcao === 'PAGAR').reduce((s, a) => s + a.valor_centavos, 0), receive = open.filter((a) => a.direcao === 'RECEBER').reduce((s, a) => s + a.valor_centavos, 0), total = pay + receive, pct = total ? Math.round(pay / total * 100) : 0
  return <div className="donut-wrap"><div className="donut" style={{ background: `conic-gradient(#0b3d6e 0 ${pct}%, #27c3a5 ${pct}% 100%)` }}><div><b>{open.length}</b><span>contas</span></div></div><div className="legend"><p><i className="pay"/><span>A pagar</span><b>{formatMoney(pay)}</b></p><p><i className="receive"/><span>A receber</span><b>{formatMoney(receive)}</b></p></div></div>
}

function Accounts({ accounts, editable, onPaid, onEdit }: { accounts: Account[]; editable: boolean; onPaid: (a: Account) => void; onEdit: (a: Account) => void }) {
  const [query, setQuery] = useState(''), [status, setStatus] = useState('TODAS'), [direction, setDirection] = useState('TODAS')
  const filtered = useMemo(() => accounts.filter((a) => { const text = `${a.fornecedor} ${a.categoria} ${a.banco}`.toLowerCase(); const state = effectiveStatus(a); return text.includes(query.toLowerCase()) && (status === 'TODAS' || state === status) && (direction === 'TODAS' || a.direcao === direction) }), [accounts, query, status, direction])
  return <section className="panel accounts-panel"><div className="filters"><div className="search table-search"><Search size={18}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar fornecedor, categoria ou banco" /></div><label><Filter size={16}/><select value={direction} onChange={(e) => setDirection(e.target.value)}><option value="TODAS">Pagar e receber</option><option value="PAGAR">A pagar</option><option value="RECEBER">A receber</option></select></label><label><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="TODAS">Todos os status</option><option value="PENDENTE">Pendentes</option><option value="ATRASADO">Em atraso</option><option value="PAGO">Pagas</option></select></label></div><AccountTable accounts={filtered} editable={editable} onPaid={onPaid} onEdit={onEdit}/></section>
}

function AccountTable({ accounts, editable, onPaid, onEdit }: { accounts: Account[]; editable: boolean; onPaid: (a: Account) => void; onEdit: (a: Account) => void }) { return <div className="table-wrap"><table><thead><tr><th>Conta</th><th>Vencimento</th><th>Categoria</th><th>Status</th><th>Valor</th><th/></tr></thead><tbody>{accounts.length ? accounts.map((a) => { const status = effectiveStatus(a); return <tr key={a.id}><td><div className={`account-icon ${a.direcao.toLowerCase()}`}>{a.direcao === 'PAGAR' ? <ReceiptText/> : <CircleDollarSign/>}</div><div><b>{a.fornecedor || a.banco || 'Conta sem fornecedor'}</b><span>{a.direcao === 'PAGAR' ? 'A pagar' : 'A receber'}{a.parcelas_total ? ` · Parcela ${a.parcela_numero}/${a.parcelas_total}` : ''}</span></div></td><td>{new Intl.DateTimeFormat('pt-BR').format(new Date(`${a.vencimento}T12:00:00`))}</td><td><span className="category">{a.categoria}</span></td><td><span className={`status ${status.toLowerCase()}`}>{status === 'PAGO' ? 'Pago' : status === 'ATRASADO' ? 'Atrasado' : 'Pendente'}</span></td><td><b>{formatMoney(a.valor_centavos)}</b></td><td>{editable ? <div className="row-actions"><button title={a.status === 'PAGO' ? 'Reabrir' : 'Registrar pagamento'} onClick={() => onPaid(a)}><Check size={17}/></button><button title="Editar" onClick={() => onEdit(a)}><MoreHorizontal size={18}/></button></div> : <span className="read-only">Somente leitura</span>}</td></tr> }) : <tr><td colSpan={6} className="empty">Nenhuma conta encontrada.</td></tr>}</tbody></table></div> }

function AccountModal({ account, spaceId, onClose, onSaved, onDelete }: { account: Account | null; spaceId: string; onClose: () => void; onSaved: () => Promise<void>; onDelete?: () => Promise<void> }) {
  const [draft, setDraft] = useState<AccountDraft>(account ? { direcao: account.direcao, fornecedor: account.fornecedor, valor: (account.valor_centavos / 100).toFixed(2).replace('.', ','), vencimento: account.vencimento, categoria: account.categoria, subcategoria: account.subcategoria || '', responsavel: account.responsavel || '', codigo: account.codigo, banco: account.banco, recorrente: account.recorrente, recorrencia: account.recorrencia } : emptyDraft), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const set = <K extends keyof AccountDraft>(key: K, value: AccountDraft[K]) => setDraft((old) => ({ ...old, [key]: value }))
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { await saveAccount(spaceId, draft, account?.id); await onSaved() } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar.') } finally { setBusy(false) } }
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">{account ? 'EDITAR' : 'NOVA'} CONTA</span><h2>{draft.direcao === 'PAGAR' ? 'Conta a pagar' : 'Conta a receber'}</h2></div><button type="button" className="icon-button" onClick={onClose}><X/></button></div><div className="segmented"><button type="button" className={draft.direcao === 'PAGAR' ? 'selected' : ''} onClick={() => set('direcao', 'PAGAR')}>A pagar</button><button type="button" className={draft.direcao === 'RECEBER' ? 'selected' : ''} onClick={() => set('direcao', 'RECEBER')}>A receber</button></div><div className="form-grid"><label className="span-2">Fornecedor / pagador<input value={draft.fornecedor} onChange={(e) => set('fornecedor', e.target.value)} required /></label><label>Valor<input value={draft.valor} onChange={(e) => set('valor', e.target.value)} placeholder="0,00" required /></label><label>Vencimento<input type="date" value={draft.vencimento} onChange={(e) => set('vencimento', e.target.value)} required /></label><label>Categoria<input value={draft.categoria} onChange={(e) => set('categoria', e.target.value)} required /></label><label>Subcategoria<input value={draft.subcategoria} onChange={(e) => set('subcategoria', e.target.value)} /></label><label>Responsável / pagador<input value={draft.responsavel} onChange={(e) => set('responsavel', e.target.value)} /></label><label>Banco / emissor<input value={draft.banco} onChange={(e) => set('banco', e.target.value)} /></label><label className="span-2">Código do boleto ou Pix<input value={draft.codigo} onChange={(e) => set('codigo', e.target.value)} /></label><label className="check span-2"><input type="checkbox" checked={draft.recorrente} onChange={(e) => set('recorrente', e.target.checked)} />Esta conta é recorrente</label>{draft.recorrente && <label className="span-2">Recorrência<select value={draft.recorrencia} onChange={(e) => set('recorrencia', e.target.value)}><option>Semanal</option><option>Mensal</option><option>Bimestral</option><option>Trimestral</option><option>Semestral</option><option>Anual</option></select></label>}</div>{error && <div className="form-message">{error}</div>}<div className="modal-actions">{onDelete && <button type="button" className="danger" onClick={onDelete}>Mover para lixeira</button>}<span/><button type="button" className="ghost" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar conta'}</button></div></form></div>
}

function ModulePlaceholder({ name }: { name: string }) { return <section className="panel placeholder"><div className="placeholder-icon"><FileText/></div><h2>{name}</h2><p>A fundação, navegação e permissões deste módulo já estão preparadas. A implementação funcional será feita na próxima etapa, reproduzindo as regras do Android.</p><span>Sem dados fictícios e sem cobrança ativa</span></section> }

function SpacesManager({ spaces, plan, selectedId, currentRole, userId, onSelect, onCreated }: { spaces: Space[]; plan: Plan; selectedId: string; currentRole: Space['role']; userId: string; onSelect: (id: string) => void; onCreated: () => Promise<void> }) {
  const [showForm, setShowForm] = useState(false), [name, setName] = useState(''), [type, setType] = useState<'PESSOAL' | 'FAMILIA' | 'EMPRESA'>('PESSOAL'), [access, setAccess] = useState<{ members: Array<{ user_id: string; role: string; name: string }>; invites: Array<{ id: string; email: string; role: string }> }>({ members: [], invites: [] }), [email, setEmail] = useState(''), [inviteRole, setInviteRole] = useState<'ADMIN' | 'EDITOR' | 'VIEWER'>('EDITOR'), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  async function create() { if (!name.trim()) return; setBusy(true); setError(''); try { await createSpace(name.trim(), type); setName(''); setShowForm(false); await onCreated() } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível criar o espaço.') } finally { setBusy(false) } }
  async function inspect(spaceId: string) { onSelect(spaceId); try { setAccess(await loadSpaceAccess(spaceId)) } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar integrantes.') } }
  async function invite() { if (!email.trim()) return; setBusy(true); setError(''); try { await inviteToSpace(selectedId, email, inviteRole, userId); setEmail(''); setAccess(await loadSpaceAccess(selectedId)) } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível enviar o convite.') } finally { setBusy(false) } }
  async function role(user: string, next: 'ADMIN' | 'EDITOR' | 'VIEWER') { try { await changeMemberRole(selectedId, user, next); setAccess(await loadSpaceAccess(selectedId)) } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível alterar o papel.') } }
  async function remove(user: string) { try { await removeSpaceMember(selectedId, user); setAccess(await loadSpaceAccess(selectedId)) } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível remover o integrante.') } }
  const max = plan === 'FREE' ? 2 : plan === 'PRO' ? 10 : Infinity
  return <section className="spaces-page"><div className="spaces-toolbar"><div><h2>Seus espaços</h2><p>Organize contas pessoais, da família ou da empresa.</p></div><button className="primary" onClick={() => setShowForm((v) => !v)}><Plus size={18}/>Novo espaço</button></div>{error && <div className="form-message">{error}</div>}{showForm && <div className="panel space-form"><label>Nome do espaço<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Minha empresa" /></label><label>Tipo<select value={type} onChange={(e) => setType(e.target.value as typeof type)}><option value="PESSOAL">Pessoal</option><option value="FAMILIA">Família</option><option value="EMPRESA">Empresa</option></select></label><div><button className="ghost" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary" disabled={busy || spaces.length >= max} onClick={create}>{busy ? 'Criando…' : 'Criar espaço'}</button></div>{spaces.length >= max && <small>Limite do plano {plan} atingido. A RPC do Supabase também valida esse limite.</small>}</div>}<div className="space-grid">{spaces.map((space) => <article key={space.id} className={space.id === selectedId ? 'space-card selected' : 'space-card'} onClick={() => inspect(space.id)}><div className="space-card-top"><i style={{ background: space.cor }}><WalletCards size={20}/></i><span className={`role ${space.role.toLowerCase()}`}>{space.role}</span></div><h3>{space.nome}</h3><p>{space.tipo.toLowerCase()} · {space.role === 'VIEWER' ? 'Somente consulta' : 'Pode registrar pagamentos'}</p>{space.id === selectedId && <small>{access.members.length + 1} integrante(s) · RLS ativo</small>}</article>)}</div>{selectedId && <section className="panel access-panel"><div className="panel-head"><div><h2>Integrantes e convites</h2><p>{currentRole === 'OWNER' || currentRole === 'ADMIN' ? 'Gerencie quem pode acessar este espaço.' : 'Você pode consultar os integrantes deste espaço.'}</p></div></div>{(currentRole === 'OWNER' || currentRole === 'ADMIN') && <div className="invite-row"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com"/><select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}><option value="ADMIN">Administrador</option><option value="EDITOR">Editor</option><option value="VIEWER">Leitor</option></select><button className="primary" onClick={invite} disabled={busy}><Plus size={16}/>Convidar</button></div>}<div className="member-list">{access.members.map((member) => <div className="member-row" key={member.user_id}><div className="avatar">{member.name.slice(0, 2).toUpperCase()}</div><div><b>{member.name}</b><small>{member.role}</small></div><span/>{(currentRole === 'OWNER' || currentRole === 'ADMIN') && member.user_id !== userId && <><select value={member.role} onChange={(e) => role(member.user_id, e.target.value as 'ADMIN' | 'EDITOR' | 'VIEWER')}><option>ADMIN</option><option>EDITOR</option><option>VIEWER</option></select><button className="danger" onClick={() => remove(member.user_id)}>Remover</button></>}</div>)}{access.invites.map((invite) => <div className="member-row pending" key={invite.id}><div className="avatar">?</div><div><b>{invite.email}</b><small>Convite pendente · {invite.role}</small></div><span/></div>)}</div></section>}</section>
}

