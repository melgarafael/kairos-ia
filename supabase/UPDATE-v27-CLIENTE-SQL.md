-- Preferências de dashboard e presets de filtros para Reports
-- Observa: seguir convenção do projeto de criar migrações separadas do CLIENT-SQL-SETUP

create table if not exists user_dashboard_prefs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  page text not null,
  tab text not null,
  widgets jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_user_dashboard_prefs_org_user on user_dashboard_prefs(organization_id, user_id);

create table if not exists report_filter_presets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  name text not null,
  filters jsonb not null,
  created_at timestamptz default now()
);

create index if not exists idx_report_filter_presets_org_user on report_filter_presets(organization_id, user_id);



-- 1) Marcar versão
insert into public.app_migrations (version, applied_at)
values ('27', now())
on conflict (version) do nothing;
