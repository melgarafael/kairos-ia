-- Ajuste RPC: ignorar organization_id inexistente no Master (gravar NULL)
set search_path = public, auth;

create or replace function public.monetization_feedback_submit(
  p_completed boolean,
  p_rating int,
  p_difficulties text,
  p_liked text,
  p_suggestions text,
  p_bonus_requested boolean
) returns boolean
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_row_id uuid;
  v_pro_plan_id uuid;
  v_rating int;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  -- Normalizar rating (1..5) ou NULL
  if p_rating between 1 and 5 then
    v_rating := p_rating;
  else
    v_rating := null;
  end if;

  -- Obter organização do usuário e validar existência no Master
  select organization_id into v_org_id from public.saas_users where id = v_user_id;
  if v_org_id is not null then
    perform 1 from public.saas_organizations where id = v_org_id;
    if not found then
      v_org_id := null;
    end if;
  end if;

  insert into public.monetization_trail_feedbacks (
    user_id, organization_id, completed_first_agent, guided_impl_rating, main_difficulties, liked_most, suggestions, bonus_requested
  ) values (
    v_user_id, v_org_id, coalesce(p_completed,false), v_rating, nullif(p_difficulties,''), nullif(p_liked,''), nullif(p_suggestions,''), coalesce(p_bonus_requested,false)
  ) returning id into v_row_id;

  -- Conceder bônus Pro 7 dias quando solicitado e marcado como concluído
  if coalesce(p_completed,false) = true and coalesce(p_bonus_requested,false) = true then
    select id into v_pro_plan_id from public.saas_plans where slug = 'professional' limit 1;
    if v_pro_plan_id is not null then
      update public.saas_users
        set plan_id = v_pro_plan_id,
            desired_plan = 'professional',
            trial_started_at = coalesce(trial_started_at, now()),
            trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + interval '7 days',
            updated_at = now()
        where id = v_user_id;

      insert into public.saas_subscriptions (id, user_id, organization_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end, stripe_subscription_id, created_at, updated_at)
      values (
        gen_random_uuid(), v_user_id, v_org_id, v_pro_plan_id, 'trialing', now(), now() + interval '7 days', true, null, now(), now()
      )
      on conflict do nothing;

      update public.monetization_trail_feedbacks
        set bonus_granted = true,
            bonus_granted_at = now(),
            bonus_plan_id = v_pro_plan_id,
            updated_at = now()
        where id = v_row_id;
    end if;
  end if;

  return true;
end $$;

grant execute on function public.monetization_feedback_submit(boolean, int, text, text, text, boolean) to anon, authenticated;


