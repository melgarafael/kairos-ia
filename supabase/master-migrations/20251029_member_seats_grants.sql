-- Master migration: Grants de assentos extras por usuário (com validade)
set search_path = public, auth;

create extension if not exists pgcrypto;

create table if not exists public.saas_member_seats_grants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.saas_users(id) on delete cascade,
  quantity int not null check (quantity > 0),
  status text not null check (status in ('active','expired','canceled')) default 'active',
  granted_at timestamptz not null default now(),
  valid_until timestamptz,
  gateway text,
  external_order_id text,
  external_subscription_id text,
  issued_by text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_smsg_owner on public.saas_member_seats_grants(owner_user_id);
create index if not exists idx_smsg_status on public.saas_member_seats_grants(status);
create index if not exists idx_smsg_valid_until on public.saas_member_seats_grants(valid_until);
create unique index if not exists uidx_smsg_idempotency on public.saas_member_seats_grants(idempotency_key) where idempotency_key is not null;

alter table public.saas_member_seats_grants enable row level security;

-- Policies: dono pode ver seus grants; inserts/updates apenas via service-role/edge
drop policy if exists smsg_owner_select on public.saas_member_seats_grants;
create policy smsg_owner_select on public.saas_member_seats_grants
  for select to authenticated, anon
  using (owner_user_id = auth.uid());

-- Não criar policy de update/delete para anon/auth; apenas service-role poderá atualizar/expirar
grant select on public.saas_member_seats_grants to authenticated, anon;

-- Trigger updated_at (reutiliza touch_updated_at se já existir)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists smsg_touch on public.saas_member_seats_grants;
create trigger smsg_touch before update on public.saas_member_seats_grants
for each row execute function public.touch_updated_at();


