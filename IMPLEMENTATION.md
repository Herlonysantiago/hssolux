# HS Cash Web — implementação e auditoria

## Fonte auditada

Projeto Android localizado em `C:\Users\MERCADO\AndroidStudioProjects\Hscash`. O Android foi mantido sem alterações; o `targetSdk 36` não foi tocado. Foram conferidos modelos Room, repositórios Supabase, autenticação, espaços, convites, permissões, sincronização, telas funcionais e todas as migrações SQL presentes.

## Entregue nesta etapa

- Supabase Auth com persistência e renovação de sessão, login e cadastro por e-mail/senha.
- Shell desktop responsivo com menu lateral, seletor de espaço, identidade do usuário e adaptação móvel.
- Carregamento de espaços próprios e compartilhados, papel efetivo e plano do perfil.
- Dashboard com contas a pagar, a receber, atrasadas, pagas, próximos vencimentos e distribuição.
- Listagem com busca e filtros de direção/status.
- CRUD de contas compatível com os campos atuais da nuvem, lixeira lógica e registro/reabertura de pagamento.
- Bloqueio visual de escrita para `VIEWER`; RLS continua sendo a autoridade final.
- Estados vazios e mensagens de erro sem inserir dados financeiros fictícios.

## Compatibilidade confirmada

O Android implementa contas a pagar/receber, parcelamento local, recorrência, boletos por câmera/código/PDF, Pix, categorias/subcategorias, fornecedores, responsáveis/pagadores, anexos, comprovantes, histórico, lixeira, Dashboard, Hoje, calendário, relatórios, alertas, filtros, espaços, convites e permissões. A nuvem atual cobre contas, Pix, detalhes, anexos, atividade, espaços e membros, mas não cobre integralmente todos os dados locais.

## Lacunas encontradas

1. `parcelamentoId`, `parcelaNumero` e `parcelasTotal` existem no Room, mas não nos modelos `CloudAccount`/`CloudAccountWrite` nem nas migrações antigas.
2. O plano Android é `SharedPreferences`; não há plano persistido/validado no Supabase.
3. O app chama a RPC `accept_space_invite`, mas sua definição não está nas migrações versionadas encontradas.
4. Limites de espaços são conferidos no cliente Android; sem RPC/trigger, podem ser contornados por outro cliente.
5. O limite Pro de cinco integrantes por espaço ainda precisa de decisão e enforcement servidor. A regra exata do Grátis para integrantes não está definida; não foi inventada uma cobrança ou restrição destrutiva.
6. Anexos/Storage, histórico detalhado, convites, criação de espaços, recorrência materializada, boletos/Pix avançado, Hoje, calendário, relatórios e alertas ainda precisam de telas web funcionais.
7. Conflito multiusuário continua em "última gravação vence" por `updated_at`; falta política explícita de resolução.

## Migração necessária

`supabase/migrations/202611150006_web_foundation.sql` adiciona plano, parcelamento, RPC atômica de convite e criação de espaço com limite no servidor. Execute primeiro em homologação e faça backup. Depois da migração, atualizar os modelos Android de nuvem para sincronizar os três campos de parcelamento; não alterar registros antigos automaticamente.

## Testes desta etapa

- Testes unitários: papéis de edição/gestão, leitor somente consulta, parser monetário brasileiro e consolidação financeira sem lixeira.
- Build de produção TypeScript/Vite.
- O teste integrado contra o Supabase real depende de `.env.local` e de usuários/espaços de homologação; nenhuma chave secreta foi copiada para o projeto.

## Próxima etapa recomendada

Aplicar a migração em homologação, validar login e RLS com quatro usuários (owner/admin/editor/viewer), então implementar espaços/convites e anexos. Em seguida: Hoje/calendário/alertas, histórico/lixeira, recorrências/parcelamentos completos e relatórios. Publicação futura prevista em `cash.hssolux.com.br`, sem alterar o callback Android.

