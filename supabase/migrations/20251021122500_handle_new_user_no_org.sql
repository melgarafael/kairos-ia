-- Master: Simplificar handle_new_user para não criar org nem setar organization_id
set search_path = public, auth;

-- Substitui a função handle_new_user para criar apenas a linha em saas_users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  trial_plan_id uuid;
  final_plan_id uuid;
  user_name text;
  email_verified boolean;
begin
  -- Determinar plan_id inicial: metadata.plan_id → slug; fallback trial
  select id into trial_plan_id from public.saas_plans where slug = 'trial' limit 1;
  if (NEW.raw_user_meta_data ? 'plan_id') then
    select id into final_plan_id from public.saas_plans where slug = NEW.raw_user_meta_data->>'plan_id' limit 1;
  end if;
  if final_plan_id is null then final_plan_id := trial_plan_id; end if;

  user_name := coalesce(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  email_verified := coalesce(NEW.email_confirmed_at is not null, false);

  -- Inserir somente o usuário SaaS (sem organization_id, sem criar org)
  insert into public.saas_users (
    id, email, name, role, active, email_verified, plan_id, setup_completed, created_at, updated_at
  ) values (
    NEW.id,
    NEW.email,
    user_name,
    'owner',
    true,
    email_verified,
    final_plan_id,
    false,
    now(),
    now()
  )
  on conflict (id) do nothing;

  return NEW;
exception when others then
  -- Não falhar o signup
  return NEW;
end;
$$;

-- Recriar trigger para usar a nova função
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


