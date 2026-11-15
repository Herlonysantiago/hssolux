export type Plan = 'FREE' | 'PRO' | 'BUSINESS'
export type MemberRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'
export type AccountDirection = 'PAGAR' | 'RECEBER'
export type AccountStatus = 'PENDENTE' | 'PAGO' | 'EXCLUIDO'

export interface Space {
  id: string
  nome: string
  tipo: 'PESSOAL' | 'FAMILIA' | 'EMPRESA'
  icone: string
  cor: string
  owner_id: string
  role: MemberRole
}

export interface Account {
  id: string
  space_id: string
  legacy_id: string | null
  codigo: string
  banco: string
  valor_centavos: number
  vencimento: string
  tipo: string
  fornecedor: string
  categoria: string
  subcategoria: string | null
  responsavel: string | null
  status: AccountStatus
  pago_em: string | null
  forma_pagamento: string | null
  observacao_pagamento: string | null
  pago_por: string | null
  recorrente: boolean
  recorrencia: string
  direcao: AccountDirection
  cliente_whatsapp: string | null
  pix_copia_cola: string | null
  pix_chave: string | null
  pix_recebedor: string | null
  pix_txid: string | null
  pix_agendado: boolean
  pix_agendamento_status: string | null
  parcelamento_id: string | null
  parcela_numero: number | null
  parcelas_total: number | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface AccountDraft {
  direcao: AccountDirection
  fornecedor: string
  valor: string
  vencimento: string
  categoria: string
  subcategoria: string
  responsavel: string
  codigo: string
  banco: string
  recorrente: boolean
  recorrencia: string
}

