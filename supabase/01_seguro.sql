-- Rota Financeira 3.1 — execute no SQL Editor de um projeto Supabase controlado pelo responsável.
-- NUNCA coloque service_role, JWT secret ou senhas neste repositório.
-- Revise backups e políticas antes de executar em um banco com dados existentes.
begin;

create table if not exists public.finance_vault (
 user_id uuid primary key references auth.users(id) on delete cascade,
 vault jsonb not null,
 revision bigint not null default 1 check (revision > 0),
 updated_at timestamptz not null default now()
);

alter table public.finance_vault
 add column if not exists revision bigint not null default 1;
alter table public.finance_vault enable row level security;
revoke all on public.finance_vault from public, anon, authenticated;
grant select on public.finance_vault to authenticated;

drop policy if exists rf_vault_owner_read on public.finance_vault;
create policy rf_vault_owner_read on public.finance_vault
 for select to authenticated using ((select auth.uid()) = user_id);

-- API de escrita serializável por linha: impede perda silenciosa de alterações
-- entre celulares usando p_expected_revision (CAS / optimistic concurrency).
create or replace function public.rf_write_vault(
 p_vault jsonb,
 p_expected_revision bigint
)
returns table(revision bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
 current_user_id uuid;
begin
 current_user_id := (select auth.uid());
 if current_user_id is null then
   raise exception 'LOGIN_REQUIRED' using errcode = '28000';
 end if;
 if p_expected_revision is null or p_expected_revision < 0 then
   raise exception 'INVALID_REVISION' using errcode = '22023';
 end if;
 if p_vault is null or jsonb_typeof(p_vault) <> 'object'
   or (p_vault->>'schema') is distinct from '2'
   or not (p_vault ? 'ciphertext')
   or not (p_vault ? 'salt')
   or not (p_vault ? 'iv')
   or pg_column_size(p_vault) > 5 * 1024 * 1024
 then
   raise exception 'INVALID_ENCRYPTED_VAULT' using errcode = '22023';
 end if;

 return query
 insert into public.finance_vault as fv(user_id, vault, revision, updated_at)
 values(current_user_id, p_vault, 1, now())
 on conflict(user_id) do update
   set vault = excluded.vault,
       revision = fv.revision + 1,
       updated_at = now()
   where fv.revision = p_expected_revision
 returning fv.revision, fv.updated_at;

 if not found then
   raise exception 'RF_REVISION_CONFLICT' using errcode = 'P0001';
 end if;
end;
$$;

revoke all on function public.rf_write_vault(jsonb,bigint) from public, anon;
grant execute on function public.rf_write_vault(jsonb,bigint) to authenticated;

-- Preparação segura de pontuação. Nenhum cliente pode escrever placares oficiais.
create table if not exists public.rf_weekly_rankings (
 week_start date not null,
 alias text not null check (char_length(alias) between 2 and 28),
 points integer not null check (points between 0 and 200),
 published_at timestamptz not null default now(),
 primary key(week_start, alias)
);
alter table public.rf_weekly_rankings enable row level security;
revoke all on public.rf_weekly_rankings from public, anon, authenticated;
grant select on public.rf_weekly_rankings to authenticated;
drop policy if exists rf_read_official_ranking on public.rf_weekly_rankings;
create policy rf_read_official_ranking
 on public.rf_weekly_rankings for select to authenticated using (true);
-- Inserções e atualizações são exclusivas da operação administrativa,
-- após revisão independente dos comprovantes e dos consentimentos.

commit;
