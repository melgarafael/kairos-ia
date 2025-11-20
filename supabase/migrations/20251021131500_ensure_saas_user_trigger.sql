-- Master: Trigger minimalista e idempotente para garantir saas_users
set search_path = public, auth;

create or replace function public.ensure_saas_user()
returns trigger
language plpgsql
security definer
as $$
declare
  v_plan_id uuid;
begin
  -- Plano opcional (não bloquear se não existir)
  begin
    select id into v_plan_id from public.saas_plans where slug = 'trial' limit 1;
  exception when others then
    v_plan_id := null;
  end;

  insert into public.saas_users (
    id, email, name, role, active, email_verified, plan_id, setup_completed, created_at, updated_at
  ) values (
    NEW.id,
    NEW.email,
    coalesce(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'owner',
    true,
    coalesce(NEW.email_confirmed_at is not null, false),
    v_plan_id,
    false,
    now(),
    now()
  ) on conflict (id) do nothing;

  return NEW;
exception when others then
  -- nunca bloquear o signup
  return NEW;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.ensure_saas_user();

-- Backfill idempotente para garantir consistência pós-deploy
do $$
declare v_trial uuid;
begin
  begin select id into v_trial from public.saas_plans where slug = 'trial' limit 1; exception when others then v_trial := null; end;
  insert into public.saas_users (id, email, name, role, active, email_verified, plan_id, setup_completed, created_at, updated_at)
  select u.id, u.email, coalesce(u.raw_user_meta_data->>'name', split_part(u.email,'@',1)), 'owner', true, (u.email_confirmed_at is not null), v_trial, false, now(), now()
  from auth.users u
  left join public.saas_users su on su.id = u.id
  where su.id is null;
end $$;


