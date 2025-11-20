SET search_path = public, auth;

-- Master-only: atualizar regra de acesso para olhar plano/trial por ORGANIZAÇÃO
-- Compat UI: mantém a mesma assinatura/shape esperada por src/App.tsx
-- Regras:
--  - Sem organização selecionada: não bloquear (allowed=true)
--  - Com organização selecionada: allowed = (assinatura ativa por organization_id) OR (org.trial_ends_at > now())
--  - plan_slug e plan_id passam a refletir o plano da ORGANIZAÇÃO

create or replace function public.get_access_status(p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_now timestamptz := now();
  v_user record;
  v_org record;
  v_plan_name text := null;
  v_plan_slug text := null;
  v_current_period_end timestamptz := null;
  v_has_active_subscription boolean := false;
  v_trial_active boolean := false; -- effective org trial
  v_allowed boolean := false;
begin
  select id, organization_id, desired_plan
  into v_user
  from public.saas_users
  where id = p_user_id;

  if not found then
    return jsonb_build_object('exists', false, 'allowed', false);
  end if;

  -- 1) Sem organização selecionada: não bloquear a entrada
  if v_user.organization_id is null then
    return jsonb_build_object(
      'exists', true,
      'trial_active', true,
      'has_active_subscription', false,
      'desired_plan', v_user.desired_plan,
      'plan_id', null,
      'plan_name', null,
      'plan_slug', null,
      'current_period_end', null,
      'allowed', true,
      'scope', 'no_org_selected'
    );
  end if;

  -- 2) Com organização: decidir pelo plano/trial da ORGANIZAÇÃO
  select id, plan_id, trial_ends_at
  into v_org
  from public.saas_organizations
  where id = v_user.organization_id
  limit 1;

  if v_org.plan_id is not null then
    select name, slug into v_plan_name, v_plan_slug from public.saas_plans where id = v_org.plan_id limit 1;
  end if;

  v_trial_active := coalesce(v_org.trial_ends_at, v_now) > v_now;

  -- Assinatura ativa por ORGANIZAÇÃO
  select exists(
    select 1 from public.saas_subscriptions s
    where s.organization_id = v_user.organization_id
      and s.status = 'active'
      and (s.current_period_end is null or s.current_period_end > v_now)
  ) into v_has_active_subscription;

  select s.current_period_end into v_current_period_end
  from public.saas_subscriptions s
  where s.organization_id = v_user.organization_id
  order by s.updated_at desc nulls last
  limit 1;

  v_allowed := (v_has_active_subscription or v_trial_active);

  return jsonb_build_object(
    'exists', true,
    'trial_active', v_trial_active,
    'has_active_subscription', v_has_active_subscription,
    'desired_plan', v_user.desired_plan,
    'plan_id', v_org.plan_id,
    'plan_name', v_plan_name,
    'plan_slug', v_plan_slug,
    'current_period_end', v_current_period_end,
    'allowed', v_allowed,
    'organization_id', v_user.organization_id,
    'scope', 'organization'
  );
end;
$$;

grant execute on function public.get_access_status(uuid) to authenticated, anon;


