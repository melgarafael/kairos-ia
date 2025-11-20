-- James (ElevenLabs agent linkage) per organization

create table if not exists public.james (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  agent_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create index if not exists idx_james_org on public.james (organization_id);

alter table public.james enable row level security;

-- Shared helper to keep updated_at fresh (idempotent)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp_on_james on public.james;
create trigger set_timestamp_on_james
before update on public.james
for each row execute function public.set_updated_at();

-- RLS policies by organization context (requires set_rls_context to be called)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'james' and policyname = 'james_select_own_org'
  ) then
    create policy james_select_own_org on public.james
      for select to anon, authenticated
      using (
        organization_id is not null
        and organization_id::text = nullif(current_setting('app.organization_id', true), '')
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'james' and policyname = 'james_modify_own_org'
  ) then
    create policy james_modify_own_org on public.james
      for all to anon, authenticated
      using (
        organization_id is not null
        and organization_id::text = nullif(current_setting('app.organization_id', true), '')
      )
      with check (
        organization_id is not null
        and organization_id::text = nullif(current_setting('app.organization_id', true), '')
      );
  end if;
end $$;

-- Helper RPCs atômicos (setam contexto e operam na mesma call)
create or replace function public.james_get(p_organization_id uuid)
returns table(agent_id text)
language plpgsql security definer
as $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  return query
    select j.agent_id
    from public.james j
    where j.organization_id = p_organization_id
    limit 1;
end;
$$;
grant execute on function public.james_get(uuid) to anon, authenticated;

create or replace function public.james_upsert(p_organization_id uuid, p_agent_id text)
returns void
language plpgsql security definer
as $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  insert into public.james (organization_id, agent_id)
  values (p_organization_id, coalesce(p_agent_id, ''))
  on conflict (organization_id) do update
    set agent_id = excluded.agent_id,
        updated_at = now();
end;
$$;
grant execute on function public.james_upsert(uuid, text) to anon, authenticated;


-- 2) Marcar versão
insert into public.app_migrations (version, applied_at)
values ('14', now())
on conflict (version) do nothing;