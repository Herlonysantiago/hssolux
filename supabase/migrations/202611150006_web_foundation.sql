-- HS Cash Web: lacunas encontradas entre o Android local e a nuvem.
-- Revisar em homologação antes de executar em produção.

create type public.hs_plan as enum ('FREE', 'PRO', 'BUSINESS');
alter table public.profiles add column if not exists plan public.hs_plan not null default 'FREE';

-- Parcelamento já existe no Room Android, mas não no modelo de nuvem anterior.
alter table public.accounts
  add column if not exists parcelamento_id uuid,
  add column if not exists parcela_numero integer,
  add column if not exists parcelas_total integer;
alter table public.accounts drop constraint if exists accounts_installment_sequence_check;
alter table public.accounts add constraint accounts_installment_sequence_check check (
  (parcelamento_id is null and parcela_numero is null and parcelas_total is null)
  or (parcelamento_id is not null and parcela_numero between 1 and parcelas_total and parcelas_total between 2 and 120)
);
create index if not exists accounts_installment_idx on public.accounts(space_id, parcelamento_id) where parcelamento_id is not null;

-- A aceitação atômica é citada pelo Android, mas não está nos arquivos de migração anteriores.
create or replace function public.accept_space_invite(p_invite_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  selected public.space_invites;
  current_plan public.hs_plan;
  current_spaces integer;
  allowed_spaces integer;
begin
  select * into selected from public.space_invites where id = p_invite_id for update;
  if selected.id is null or selected.status <> 'PENDING' or selected.expires_at <= now() then
    raise exception 'Convite inválido ou expirado';
  end if;
  if lower(selected.email) <> lower(coalesce(auth.jwt() ->> 'email','')) then raise exception 'Convite pertence a outro usuário'; end if;
  select plan into current_plan from public.profiles where id = auth.uid();
  allowed_spaces := case current_plan when 'FREE' then 2 when 'PRO' then 10 else 2147483647 end;
  select count(*) into current_spaces from (
    select id from public.spaces where owner_id = auth.uid() and deleted_at is null
    union select s.id from public.spaces s join public.space_members m on m.space_id=s.id where m.user_id=auth.uid() and s.deleted_at is null
  ) accessible;
  if current_spaces >= allowed_spaces then raise exception 'Limite de espaços do plano atingido'; end if;
  insert into public.space_members(space_id,user_id,role) values(selected.space_id,auth.uid(),selected.role)
    on conflict(space_id,user_id) do update set role=excluded.role;
  update public.space_invites set status='ACCEPTED',accepted_at=now() where id=selected.id;
end; $$;
revoke all on function public.accept_space_invite(uuid) from public;
grant execute on function public.accept_space_invite(uuid) to authenticated;

-- A criação por RPC garante o limite também no servidor. O frontend não deve inserir espaços diretamente.
create or replace function public.create_space(p_nome text,p_tipo public.space_type,p_icone text default 'wallet',p_cor text default '#0B3D6E')
returns public.spaces language plpgsql security definer set search_path='' as $$
declare current_plan public.hs_plan; total integer; allowed integer; created public.spaces;
begin
  select plan into current_plan from public.profiles where id=auth.uid();
  allowed := case current_plan when 'FREE' then 2 when 'PRO' then 10 else 2147483647 end;
  select count(*) into total from (
    select id from public.spaces where owner_id=auth.uid() and deleted_at is null
    union select s.id from public.spaces s join public.space_members m on m.space_id=s.id where m.user_id=auth.uid() and s.deleted_at is null
  ) accessible;
  if total >= allowed then raise exception 'Limite de espaços do plano atingido'; end if;
  insert into public.spaces(nome,tipo,icone,cor,owner_id) values(trim(p_nome),p_tipo,p_icone,p_cor,auth.uid()) returning * into created;
  return created;
end; $$;
revoke all on function public.create_space(text,public.space_type,text,text) from public;
grant execute on function public.create_space(text,public.space_type,text,text) to authenticated;

-- Endurece a regra pedida: VIEWER consulta, OWNER/ADMIN/EDITOR registram pagamento.
-- As policies accounts_update_editor e can_edit_space da migração inicial já aplicam essa regra.
comment on function public.can_edit_space(uuid) is 'Autoriza OWNER, ADMIN e EDITOR; VIEWER permanece somente leitura.';

