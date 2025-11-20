-- v15 – n8n connections per organization + RPCs (security definer)

create table if not exists public.n8n_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  base_url text not null,
  api_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create index if not exists idx_n8n_connections_org on public.n8n_connections (organization_id);

alter table public.n8n_connections enable row level security;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

drop trigger if exists trg_n8n_conn_updated_at on public.n8n_connections;
create trigger trg_n8n_conn_updated_at before update on public.n8n_connections
for each row execute function public.set_updated_at();

do $$
begin
  if not exists (select 1 from pg_policies where tablename='n8n_connections' and policyname='n8n_conn_select') then
    create policy n8n_conn_select on public.n8n_connections
      for select to anon, authenticated
      using (organization_id::text = nullif(current_setting('app.organization_id', true), ''));
  end if;
  if not exists (select 1 from pg_policies where tablename='n8n_connections' and policyname='n8n_conn_modify') then
    create policy n8n_conn_modify on public.n8n_connections
      for all to anon, authenticated
      using (organization_id::text = nullif(current_setting('app.organization_id', true), ''))
      with check (organization_id::text = nullif(current_setting('app.organization_id', true), ''));
  end if;
end $$;

-- Atomic RPCs
create or replace function public.n8n_get(p_organization_id uuid)
returns table(base_url text, api_key text)
language plpgsql security definer as $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  return query select c.base_url, c.api_key from public.n8n_connections c where c.organization_id = p_organization_id limit 1;
end; $$;
grant execute on function public.n8n_get(uuid) to anon, authenticated;

create or replace function public.n8n_upsert(p_organization_id uuid, p_base_url text, p_api_key text)
returns void
language plpgsql security definer as $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  insert into public.n8n_connections (organization_id, base_url, api_key)
  values (p_organization_id, p_base_url, p_api_key)
  on conflict (organization_id) do update set base_url = excluded.base_url, api_key = excluded.api_key, updated_at = now();
end; $$;
grant execute on function public.n8n_upsert(uuid, text, text) to anon, authenticated;


-- 2) Marcar versão
insert into public.app_migrations (version, applied_at)
values ('15', now())
on conflict (version) do nothing;