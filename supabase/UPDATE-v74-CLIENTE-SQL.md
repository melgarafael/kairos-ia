-- v74 – Tutorial Manychat: progresso por usuário + RPCs; RPCs da Trilha
-- Regras: executar SEMPRE no CLIENT (BYO) do usuário final.

-- 1) Tabela: progresso do tutorial Manychat por organization_id + user_id + step_id
create table if not exists public.tutorial_manychat_progress (
  organization_id uuid not null,
  user_id uuid not null,
  step_id text not null,
  completed boolean not null default true,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tutorial_manychat_progress_pkey primary key (organization_id, user_id, step_id)
);

-- 1.1) Trigger updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tutorial_manychat_progress_set_updated_at on public.tutorial_manychat_progress;
create trigger tutorial_manychat_progress_set_updated_at
before update on public.tutorial_manychat_progress
for each row execute function public.set_updated_at();

-- 1.2) RLS (usa app.organization_id na sessão)
alter table public.tutorial_manychat_progress enable row level security;

drop policy if exists "mc_read_org" on public.tutorial_manychat_progress;
create policy "mc_read_org" on public.tutorial_manychat_progress
  for select to authenticated
  using ((organization_id::text = current_setting('app.organization_id', true)));

drop policy if exists "mc_write_org" on public.tutorial_manychat_progress;
create policy "mc_write_org" on public.tutorial_manychat_progress
  for insert to authenticated
  with check ((organization_id::text = current_setting('app.organization_id', true)));

drop policy if exists "mc_update_org" on public.tutorial_manychat_progress;
create policy "mc_update_org" on public.tutorial_manychat_progress
  for update to authenticated
  using ((organization_id::text = current_setting('app.organization_id', true)))
  with check ((organization_id::text = current_setting('app.organization_id', true)));

-- 2) RPCs (sempre na MESMA sessão: set_config + operação)

-- 2.1) Listar progresso Manychat por org e usuário
create or replace function public.tutorial_manychat_progress_list(
  p_organization_id uuid,
  p_user_id uuid
)
returns setof public.tutorial_manychat_progress
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  return query
  select * from public.tutorial_manychat_progress
  where organization_id = p_organization_id and user_id = p_user_id
  order by step_id asc;
end;
$$;

grant execute on function public.tutorial_manychat_progress_list(uuid, uuid) to authenticated, anon;

-- 2.2) Upsert de um passo Manychat
create or replace function public.tutorial_manychat_progress_upsert(
  p_organization_id uuid,
  p_user_id uuid,
  p_step_id text,
  p_completed boolean default true
)
returns public.tutorial_manychat_progress
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row public.tutorial_manychat_progress;
begin
  perform set_config('app.organization_id', p_organization_id::text, true);

  insert into public.tutorial_manychat_progress (organization_id, user_id, step_id, completed, completed_at)
  values (p_organization_id, p_user_id, p_step_id, coalesce(p_completed, true), case when coalesce(p_completed, true) then now() else null end)
  on conflict (organization_id, user_id, step_id) do update
    set completed = excluded.completed,
        completed_at = case when excluded.completed then now() else null end,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.tutorial_manychat_progress_upsert(uuid, uuid, text, boolean) to authenticated, anon;

-- 3) RPCs da Trilha (caso projeto ainda não possua)
-- 3.1) Listar progresso da trilha por organização
create or replace function public.monetization_trail_progress_list(
  p_organization_id uuid
)
returns table(step_key text, completed boolean, completed_at timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  return query
  select step_key, completed, completed_at
  from public.monetization_trail_progress
  where organization_id = p_organization_id
  order by step_key asc;
end;
$$;

grant execute on function public.monetization_trail_progress_list(uuid) to authenticated, anon;

-- 3.2) Upsert de um passo da trilha
create or replace function public.monetization_trail_progress_upsert(
  p_organization_id uuid,
  p_step_key text,
  p_completed boolean
)
returns public.monetization_trail_progress
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row public.monetization_trail_progress;
begin
  perform set_config('app.organization_id', p_organization_id::text, true);

  insert into public.monetization_trail_progress (organization_id, step_key, completed, completed_at)
  values (p_organization_id, p_step_key, coalesce(p_completed, true), case when coalesce(p_completed, true) then now() else null end)
  on conflict (organization_id, step_key) do update
    set completed = excluded.completed,
        completed_at = case when excluded.completed then now() else null end,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.monetization_trail_progress_upsert(uuid, text, boolean) to authenticated, anon;

-- 4) Marcar versão
insert into public.app_migrations (version, applied_at)
values ('74', now())
on conflict (version) do nothing;


