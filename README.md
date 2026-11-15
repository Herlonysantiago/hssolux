# HS Cash Web

Painel web responsivo do HS Cash, construído a partir do aplicativo Android existente e integrado ao mesmo Supabase. Esta etapa implementa autenticação e sessão, leitura de espaços e papéis, dashboard, listagem com filtros e CRUD básico de contas.

## Executar

1. Copie `.env.example` para `.env.local`.
2. Preencha a URL e a chave **publicável** do mesmo projeto Supabase usado pelo Android. Nunca use `service_role`.
3. Execute `npm install`, `npm run test` e `npm run dev`.

O callback web a cadastrar no Supabase Auth deve apontar para a URL local e, futuramente, para `https://cash.hssolux.com.br`. O callback Android `hscash://auth-callback/` deve ser preservado.

O login também oferece Google. No Supabase, ative Authentication > Providers > Google, informe as credenciais OAuth do Google Cloud e adicione `http://localhost:4173/` e `https://cash.hssolux.com.br/` em Redirect URLs.

## Segurança

- O navegador usa apenas a chave publicável e depende integralmente das policies RLS.
- Dono, administrador e editor podem criar, editar, excluir logicamente e registrar pagamentos.
- Leitor não recebe ações de escrita na interface e continua bloqueado pela RLS.
- Cobrança não foi ativada. `plan` representa somente o nível de acesso registrado.
- Nenhuma funcionalidade de conta bancária, saldo por conta ou transferência foi adicionada.

Veja `IMPLEMENTATION.md` para escopo verificado, testes, lacunas e migrações.

