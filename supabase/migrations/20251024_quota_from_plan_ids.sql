-- Master: Quota baseada exclusivamente em plano base + extras
set search_path = public, auth;

-- Recriar função get_org_member_quota ignorando max_members_per_org e lendo plano por IDs fixos
create or replace function public.get_org_member_quota(p_client_org_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
  v_plan_id uuid;
  v_plan_limit int := 0; -- convites além do owner
  v_extra int := 0;
  v_inviter uuid;
  v_inviter_plan uuid;
begin
  -- Mapear owner e plano do Master a partir da organização do Client
  select o.owner_id, coalesce(o.plan_id, u.plan_id)
    into v_owner_id, v_plan_id
  from public.saas_organizations o
  left join public.saas_users u on u.id = o.owner_id
  where o.client_org_id = p_client_org_id
  limit 1;

  -- Fallback: se plano não encontrado via organização, usar plano do usuário autenticado (convidador)
  if v_plan_id is null then
    begin
      v_inviter := auth.uid();
    exception when others then v_inviter := null; end;
    if v_inviter is not null then
      select plan_id into v_inviter_plan from public.saas_users where id = v_inviter;
      if v_inviter_plan is not null then
        v_plan_id := v_inviter_plan;
      end if;
    end if;
  end if;

  -- Definir limite base por IDs de planos (convites além do owner)
  if v_plan_id is not null then
    if v_plan_id = '4663da1a-b552-4127-b1af-4bc30c681682'::uuid then
      -- TRIAL: total 1 (apenas owner) => convites = 0
      v_plan_limit := 0;
    elsif v_plan_id = '8b5a1000-957c-4eaf-beca-954a78187337'::uuid then
      -- STARTER: total 2 => convites = 1
      v_plan_limit := 1;
    elsif v_plan_id = 'd4836a79-186f-4905-bfac-77ec52fa1dde'::uuid then
      -- PRO: total 3 => convites = 2
      v_plan_limit := 2;
    else
      -- Outros planos: conservador (0) até termos regra explícita
      v_plan_limit := 0;
    end if;
  end if;

  -- Extras por conta (assentos adicionais comprados)
  if v_owner_id is not null then
    select coalesce(member_seats_extra, 0) into v_extra from public.saas_users where id = v_owner_id;
  end if;

  return jsonb_build_object(
    'allowed', greatest(0, v_plan_limit + v_extra),
    'plan_limit', v_plan_limit,
    'extra', v_extra
  );
end $$;

grant execute on function public.get_org_member_quota(uuid) to authenticated, anon;


