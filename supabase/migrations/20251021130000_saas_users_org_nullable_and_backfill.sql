-- Master: Tornar organization_id anulável em saas_users e realizar backfill de usuários ausentes
set search_path = public, auth;

-- 1) Permitir usuário sem organização no Master
do $$ begin
  -- Se a coluna já for anulável, este comando é idempotente
  execute 'alter table public.saas_users alter column organization_id drop not null';
exception when others then
  -- Em alguns ambientes (ex.: coluna já anulável), ignorar erro
  null;
end $$;

-- 1.1) Garantir colunas opcionais (idempotente)
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saas_users' and column_name = 'email_verified'
  ) then
    alter table public.saas_users add column email_verified boolean;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saas_users' and column_name = 'plan_id'
  ) then
    alter table public.saas_users add column plan_id uuid references public.saas_plans(id);
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saas_users' and column_name = 'setup_completed'
  ) then
    alter table public.saas_users add column setup_completed boolean default false;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saas_users' and column_name = 'name'
  ) then
    alter table public.saas_users add column name text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saas_users' and column_name = 'role'
  ) then
    alter table public.saas_users add column role text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saas_users' and column_name = 'active'
  ) then
    alter table public.saas_users add column active boolean default true;
  end if;
end $$;

-- 2) Backfill de usuários ausentes em public.saas_users a partir de auth.users
do $$
declare v_trial_id uuid;
begin
  begin
    select id into v_trial_id from public.saas_plans where slug = 'trial' limit 1;
  exception when others then
    v_trial_id := null;
  end;

  insert into public.saas_users (
    id, email, name, role, active, email_verified, plan_id, setup_completed, created_at, updated_at
  )
  select
    u.id,
    u.email,
    coalesce(u.raw_user_meta_data->>'name', split_part(u.email,'@',1)),
    'owner',
    true,
    (u.email_confirmed_at is not null),
    v_trial_id,
    false,
    now(),
    now()
  from auth.users u
  left join public.saas_users su on su.id = u.id
  where su.id is null;
end $$;


