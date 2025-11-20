-- Master migration: Tokens de Plano por usuário (inventário de planos)
set search_path = public, auth;

create extension if not exists pgcrypto;

create table if not exists public.saas_plan_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.saas_users(id) on delete cascade,
  plan_id uuid not null references public.saas_plans(id),
  status text not null check (status in ('available','redeemed','expired','canceled')) default 'available',
  purchased_at timestamptz not null default now(),
  valid_until timestamptz,
  gateway text,
  external_order_id text,
  external_subscription_id text,
  issued_by text,
  applied_organization_id uuid references public.saas_organizations(id) on delete set null,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_spt_owner on public.saas_plan_tokens(owner_user_id);
create index if not exists idx_spt_status on public.saas_plan_tokens(status);
create index if not exists idx_spt_plan on public.saas_plan_tokens(plan_id);
create index if not exists idx_spt_valid_until on public.saas_plan_tokens(valid_until);

alter table public.saas_plan_tokens enable row level security;

-- Policies: dono pode ver e atualizar seus tokens (aplicar/cancelar)
drop policy if exists spt_owner_select on public.saas_plan_tokens;
create policy spt_owner_select on public.saas_plan_tokens
  for select to authenticated, anon
  using (owner_user_id = auth.uid());

drop policy if exists spt_owner_update on public.saas_plan_tokens;
create policy spt_owner_update on public.saas_plan_tokens
  for update to authenticated, anon
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- insert apenas via service-role/edge (sem policy para anon/auth)
grant select, update on public.saas_plan_tokens to authenticated, anon;

-- Trigger updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists spt_touch on public.saas_plan_tokens;
create trigger spt_touch before update on public.saas_plan_tokens
for each row execute function public.touch_updated_at();


