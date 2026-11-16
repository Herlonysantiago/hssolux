import { createClient, type Session } from '@supabase/supabase-js'
import type { Account, AccountDraft, MemberRole, Plan, Space } from './types'
import { parseMoney } from './domain'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
export const configured = Boolean(url?.startsWith('https://') && key)
export const supabase = configured ? createClient(url!, key!, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.local.')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signUp(email: string, password: string, name: string) {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.local.')
  const { error } = await supabase.auth.signUp({ email, password, options: { data: { name } } })
  if (error) throw error
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.local.')
  const redirectTo = `${window.location.origin}/`
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
  if (error) throw error
}

export async function loadWorkspace(session: Session) {
  if (!supabase) throw new Error('Supabase não configurado.')
  const [{ data: spaces, error: spacesError }, { data: members, error: membersError }, { data: profile }] = await Promise.all([
    supabase.from('spaces').select('id,nome,tipo,icone,cor,owner_id').is('deleted_at', null).order('created_at'),
    supabase.from('space_members').select('space_id,user_id,role').eq('user_id', session.user.id),
    supabase.from('profiles').select('nome,plan').eq('id', session.user.id).maybeSingle(),
  ])
  if (spacesError) throw spacesError
  if (membersError) throw membersError
  const roleBySpace = new Map((members ?? []).map((m) => [m.space_id, m.role as MemberRole]))
  const accessible = (spaces ?? []).map((space): Space => ({
    ...space,
    role: space.owner_id === session.user.id ? 'OWNER' : (roleBySpace.get(space.id) ?? 'VIEWER'),
  }))
  return { spaces: accessible, plan: (profile?.plan ?? 'FREE') as Plan, name: profile?.nome || session.user.email || 'Usuário' }
}

export async function loadAccounts(spaceId: string) {
  if (!supabase) return []
  const { data, error } = await supabase.from('accounts').select('*').eq('space_id', spaceId).order('vencimento')
  if (error) throw error
  return (data ?? []) as Account[]
}

export async function createSpace(nome: string, tipo: 'PESSOAL' | 'FAMILIA' | 'EMPRESA') {
  if (!supabase) throw new Error('Supabase não configurado.')
  const { data, error } = await supabase.rpc('create_space', { p_nome: nome, p_tipo: tipo, p_icone: 'wallet', p_cor: '#0B3D6E' })
  if (error) throw error
  return data
}

export async function loadSpaceMembers(spaceId: string) {
  if (!supabase) return []
  const { data, error } = await supabase.from('space_members').select('user_id,role,created_at').eq('space_id', spaceId)
  if (error) throw error
  return data ?? []
}

export async function loadSpaceAccess(spaceId: string) {
  if (!supabase) return { members: [], invites: [] }
  const [{ data: members, error: membersError }, { data: invites, error: invitesError }] = await Promise.all([
    supabase.from('space_members').select('user_id,role,created_at').eq('space_id', spaceId),
    supabase.from('space_invites').select('id,email,role,status,expires_at').eq('space_id', spaceId).eq('status', 'PENDING'),
  ])
  if (membersError) throw membersError
  if (invitesError) throw invitesError
  const ids = (members ?? []).map((member) => member.user_id)
  const { data: profiles } = ids.length ? await supabase.from('profiles').select('id,nome').in('id', ids) : { data: [] }
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.nome || 'Integrante']))
  return { members: (members ?? []).map((member) => ({ ...member, name: names.get(member.user_id) || 'Integrante' })), invites: invites ?? [] }
}

export async function inviteToSpace(spaceId: string, email: string, role: 'ADMIN' | 'EDITOR' | 'VIEWER', invitedBy: string) {
  if (!supabase) throw new Error('Supabase não configurado.')
  const { error } = await supabase.from('space_invites').insert({ space_id: spaceId, email: email.trim().toLowerCase(), role, invited_by: invitedBy })
  if (error) throw error
}

export async function changeMemberRole(spaceId: string, userId: string, role: 'ADMIN' | 'EDITOR' | 'VIEWER') {
  if (!supabase) throw new Error('Supabase não configurado.')
  const { error } = await supabase.from('space_members').update({ role }).eq('space_id', spaceId).eq('user_id', userId)
  if (error) throw error
}

export async function removeSpaceMember(spaceId: string, userId: string) {
  if (!supabase) throw new Error('Supabase não configurado.')
  const { error } = await supabase.from('space_members').delete().eq('space_id', spaceId).eq('user_id', userId)
  if (error) throw error
}

export async function saveAccount(spaceId: string, draft: AccountDraft, accountId?: string) {
  if (!supabase) throw new Error('Supabase não configurado.')
  const payload = {
    space_id: spaceId,
    codigo: draft.codigo.trim(), banco: draft.banco.trim(), valor_centavos: parseMoney(draft.valor),
    vencimento: draft.vencimento, tipo: draft.codigo ? 'BOLETO' : 'MANUAL', fornecedor: draft.fornecedor.trim(),
    categoria: draft.categoria.trim() || 'Outros', subcategoria: draft.subcategoria.trim() || null,
    responsavel: draft.responsavel.trim() || null, recorrente: draft.recorrente,
    recorrencia: draft.recorrencia, direcao: draft.direcao,
  }
  const result = accountId
    ? await supabase.from('accounts').update(payload).eq('id', accountId)
    : await supabase.from('accounts').insert({ ...payload, legacy_id: crypto.randomUUID() })
  if (result.error) throw result.error
}

export async function markPaid(account: Account, paidBy?: string) {
  if (!supabase) throw new Error('Supabase não configurado.')
  const nextPaid = account.status !== 'PAGO'
  const { error } = await supabase.from('accounts').update({
    status: nextPaid ? 'PAGO' : 'PENDENTE', pago_em: nextPaid ? new Date().toISOString() : null,
    pago_por: nextPaid ? paidBy || null : null,
  }).eq('id', account.id)
  if (error) throw error
}

export async function softDeleteAccount(accountId: string) {
  if (!supabase) throw new Error('Supabase não configurado.')
  const { error } = await supabase.from('accounts').update({ status: 'EXCLUIDO', deleted_at: new Date().toISOString() }).eq('id', accountId)
  if (error) throw error
}

