import type { Account, MemberRole, Plan } from './types'

export const PLAN_LIMITS: Record<Plan, { spaces: number; members: number }> = {
  FREE: { spaces: 2, members: 1 },
  PRO: { spaces: 10, members: 5 },
  BUSINESS: { spaces: Number.POSITIVE_INFINITY, members: Number.POSITIVE_INFINITY },
}

export function canEdit(role: MemberRole) {
  return role === 'OWNER' || role === 'ADMIN' || role === 'EDITOR'
}

export function canManage(role: MemberRole) {
  return role === 'OWNER' || role === 'ADMIN'
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

export function parseMoney(value: string) {
  const normalized = value.replace(/R\$|\s/g, '').replace(/\./g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

export function effectiveStatus(account: Account, today = new Date()) {
  if (account.status === 'PAGO') return 'PAGO'
  const due = new Date(`${account.vencimento}T23:59:59`)
  return due < today ? 'ATRASADO' : 'PENDENTE'
}

export function summarize(accounts: Account[]) {
  const active = accounts.filter((account) => !account.deleted_at)
  const open = active.filter((account) => account.status !== 'PAGO')
  const paid = active.filter((account) => account.status === 'PAGO')
  return {
    toPay: open.filter((a) => a.direcao === 'PAGAR').reduce((sum, a) => sum + a.valor_centavos, 0),
    toReceive: open.filter((a) => a.direcao === 'RECEBER').reduce((sum, a) => sum + a.valor_centavos, 0),
    overdue: open.filter((a) => effectiveStatus(a) === 'ATRASADO').reduce((sum, a) => sum + a.valor_centavos, 0),
    paid: paid.reduce((sum, a) => sum + a.valor_centavos, 0),
  }
}

