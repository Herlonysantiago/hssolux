import { describe, expect, it } from 'vitest'
import { canEdit, canManage, parseMoney, summarize } from './domain'
import type { Account } from './types'

const account = (overrides: Partial<Account>): Account => ({ id: '1', space_id: 's', legacy_id: 'l', codigo: '', banco: '', valor_centavos: 10000, vencimento: '2099-01-01', tipo: 'MANUAL', fornecedor: 'Teste', categoria: 'Outros', subcategoria: null, responsavel: null, status: 'PENDENTE', pago_em: null, forma_pagamento: null, observacao_pagamento: null, pago_por: null, recorrente: false, recorrencia: 'Mensal', direcao: 'PAGAR', cliente_whatsapp: null, pix_copia_cola: null, pix_chave: null, pix_recebedor: null, pix_txid: null, pix_agendado: false, pix_agendamento_status: null, parcelamento_id: null, parcela_numero: null, parcelas_total: null, deleted_at: null, created_at: '', updated_at: '', ...overrides })

describe('permissões compartilhadas', () => {
  it('permite editar e pagar para dono, administrador e editor', () => { expect(['OWNER', 'ADMIN', 'EDITOR'].every((role) => canEdit(role as never))).toBe(true) })
  it('mantém leitor somente para consulta', () => { expect(canEdit('VIEWER')).toBe(false); expect(canManage('EDITOR')).toBe(false) })
})
describe('regras financeiras', () => {
  it('interpreta valores brasileiros', () => { expect(parseMoney('R$ 1.234,56')).toBe(123456) })
  it('separa pagar, receber e pago sem incluir lixeira', () => { const result = summarize([account({}), account({ id: '2', direcao: 'RECEBER', valor_centavos: 5000 }), account({ id: '3', status: 'PAGO', valor_centavos: 3000 }), account({ id: '4', deleted_at: '2026-01-01', valor_centavos: 9000 })]); expect(result.toPay).toBe(10000); expect(result.toReceive).toBe(5000); expect(result.paid).toBe(3000) })
})

