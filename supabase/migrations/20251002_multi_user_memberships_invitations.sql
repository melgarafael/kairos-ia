-- Master migration: multi-user memberships and invitations (idempotent)
set search_path = public, auth;

begin;

-- Ensure required extension for UUID generation
do $$ begin
  perform 1 from pg_extension where extname = 'pgcrypto';
  if not found then
    create extension if not exists pgcrypto;
  end if;
end $$;

-- saas_memberships: relaciona usuários a organizações do Client (por organization_id_in_client)
create table if not exists public.saas_memberships (
  id uuid primary key default gen_random_uuid(),
  saas_user_id uuid not null,
  organization_id_in_client uuid not null,
  role text not null,
  status text not null default 'active',
  invited_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- FK soft (não cascata entre bancos): referenciar saas_users localmente
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_saas_memberships_saas_user'
  ) then
    alter table public.saas_memberships
      add constraint fk_saas_memberships_saas_user
      foreign key (saas_user_id) references public.saas_users(id) on delete cascade;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_saas_memberships_invited_by'
  ) then
    alter table public.saas_memberships
      add constraint fk_saas_memberships_invited_by
      foreign key (invited_by) references public.saas_users(id) on delete set null;
  end if;
end $$;

-- Constraints de domínio
do $$ begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where constraint_name = 'ck_saas_memberships_role'
  ) then
    alter table public.saas_memberships
      add constraint ck_saas_memberships_role
      check (role in ('owner','admin','member','viewer'));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where constraint_name = 'ck_saas_memberships_status'
  ) then
    alter table public.saas_memberships
      add constraint ck_saas_memberships_status
      check (status in ('active','suspended'));
  end if;
end $$;

-- Unicidade por usuário+organização (uma membership por org)
do $$ begin
  if not exists (
    select 1 from pg_indexes where schemaname='public' and indexname='ux_saas_memberships_user_org'
  ) then
    create unique index ux_saas_memberships_user_org
      on public.saas_memberships(saas_user_id, organization_id_in_client);
  end if;
end $$;

create index if not exists idx_saas_memberships_org on public.saas_memberships(organization_id_in_client);
create index if not exists idx_saas_memberships_user on public.saas_memberships(saas_user_id);

-- saas_invitations: convites por organização do Client
create table if not exists public.saas_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  organization_id_in_client uuid not null,
  role text not null,
  token text not null,
  status text not null default 'pending',
  expires_at timestamptz not null default (now() + interval '7 days'),
  invited_by uuid,
  accepted_by uuid,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_saas_invitations_invited_by'
  ) then
    alter table public.saas_invitations
      add constraint fk_saas_invitations_invited_by
      foreign key (invited_by) references public.saas_users(id) on delete set null;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_saas_invitations_accepted_by'
  ) then
    alter table public.saas_invitations
      add constraint fk_saas_invitations_accepted_by
      foreign key (accepted_by) references public.saas_users(id) on delete set null;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where constraint_name = 'ck_saas_invitations_role'
  ) then
    alter table public.saas_invitations
      add constraint ck_saas_invitations_role
      check (role in ('owner','admin','member','viewer'));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where constraint_name = 'ck_saas_invitations_status'
  ) then
    alter table public.saas_invitations
      add constraint ck_saas_invitations_status
      check (status in ('pending','accepted','expired','revoked'));
  end if;
end $$;

create index if not exists idx_saas_invitations_email on public.saas_invitations(email);
create index if not exists idx_saas_invitations_org on public.saas_invitations(organization_id_in_client);
do $$ begin
  if not exists (
    select 1 from pg_indexes where schemaname='public' and indexname='ux_saas_invitations_token'
  ) then
    create unique index ux_saas_invitations_token on public.saas_invitations(token);
  end if;
end $$;

-- Helper function: criar convite, retorna token
create or replace function public.saas_create_invitation(
  p_email text,
  p_organization_id uuid,
  p_role text,
  p_invited_by uuid,
  p_expires_in_days int default 7
) returns text
language plpgsql
as $$
declare
  v_token text;
begin
  if p_role not in ('owner','admin','member','viewer') then
    raise exception 'invalid role';
  end if;
  v_token := encode(gen_random_bytes(24), 'hex');
  insert into public.saas_invitations(email, organization_id_in_client, role, token, invited_by, expires_at)
  values (lower(trim(p_email)), p_organization_id, p_role, v_token, p_invited_by, now() + (p_expires_in_days || ' days')::interval);
  return v_token;
end $$;

-- Helper function: aceitar convite
create or replace function public.saas_accept_invitation(
  p_token text,
  p_accepting_user_id uuid
) returns boolean
language plpgsql
as $$
declare
  v_inv public.saas_invitations%rowtype;
begin
  select * into v_inv from public.saas_invitations
   where token = p_token and status = 'pending' limit 1;
  if not found then
    return false;
  end if;
  if v_inv.expires_at < now() then
    update public.saas_invitations set status = 'expired' where id = v_inv.id;
    return false;
  end if;
  -- upsert membership
  insert into public.saas_memberships(saas_user_id, organization_id_in_client, role, status, invited_by, created_at, updated_at)
  values (p_accepting_user_id, v_inv.organization_id_in_client, v_inv.role, 'active', v_inv.invited_by, now(), now())
  on conflict (saas_user_id, organization_id_in_client)
  do update set role = excluded.role, status = 'active', updated_at = now();

  update public.saas_invitations
    set status = 'accepted', accepted_by = p_accepting_user_id, accepted_at = now()
    where id = v_inv.id;
  return true;
end $$;

commit;


