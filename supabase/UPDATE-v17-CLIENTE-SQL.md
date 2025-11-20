-- v17 – Trilha de Monetização: progresso por etapa

-- 1) Tabela de progresso por organização e etapa
create table if not exists public.monetization_trail_progress (
  organization_id uuid not null,
  step_key text not null,
  completed boolean not null default false,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monetization_trail_progress_pkey primary key (organization_id, step_key)
);

-- 2) Índices auxiliares
create index if not exists monetization_trail_progress_org_idx on public.monetization_trail_progress (organization_id);
create index if not exists monetization_trail_progress_completed_idx on public.monetization_trail_progress (completed);

-- 3) Trigger para updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists monetization_trail_progress_set_updated_at on public.monetization_trail_progress;
create trigger monetization_trail_progress_set_updated_at
before update on public.monetization_trail_progress
for each row execute function public.set_updated_at();

-- 4) RLS por organização (usa app.organization_id configurado via RPC set_rls_context)
alter table public.monetization_trail_progress enable row level security;

drop policy if exists "trail_read_org" on public.monetization_trail_progress;
create policy "trail_read_org" on public.monetization_trail_progress
  for select to authenticated
  using ((organization_id::text = current_setting('app.organization_id', true)));

drop policy if exists "trail_write_org" on public.monetization_trail_progress;
create policy "trail_write_org" on public.monetization_trail_progress
  for insert to authenticated
  with check ((organization_id::text = current_setting('app.organization_id', true)));

drop policy if exists "trail_update_org" on public.monetization_trail_progress;
create policy "trail_update_org" on public.monetization_trail_progress
  for update to authenticated
  using ((organization_id::text = current_setting('app.organization_id', true)))
  with check ((organization_id::text = current_setting('app.organization_id', true)));

-- 5) Marcar versão
insert into public.app_migrations (version, applied_at)
values ('17', now())
on conflict (version) do nothing;


