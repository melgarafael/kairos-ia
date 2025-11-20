-- Master: Feedbacks da Trilha de Monetização + bônus Pro 7 dias
set search_path = public, auth;

-- Tabela de feedbacks
create table if not exists public.monetization_trail_feedbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.saas_users(id) on delete cascade,
  organization_id uuid null references public.saas_organizations(id) on delete set null,
  completed_first_agent boolean not null default false,
  guided_impl_rating int check (guided_impl_rating between 1 and 5),
  main_difficulties text,
  liked_most text,
  suggestions text,
  bonus_requested boolean not null default false,
  bonus_granted boolean not null default false,
  bonus_granted_at timestamptz,
  bonus_plan_id uuid references public.saas_plans(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.monetization_trail_feedbacks enable row level security;

-- Policies
do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='monetization_trail_feedbacks' and policyname='Users insert own feedbacks') then
    execute 'drop policy "Users insert own feedbacks" on public.monetization_trail_feedbacks';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='monetization_trail_feedbacks' and policyname='Users select own feedbacks') then
    execute 'drop policy "Users select own feedbacks" on public.monetization_trail_feedbacks';
  end if;
end $$;

create policy "Users insert own feedbacks"
on public.monetization_trail_feedbacks for insert to authenticated
with check (user_id = auth.uid());

create policy "Users select own feedbacks"
on public.monetization_trail_feedbacks for select to authenticated
using (user_id = auth.uid());

-- Indexes
create index if not exists monetization_trail_feedbacks_user_idx on public.monetization_trail_feedbacks(user_id);
create index if not exists monetization_trail_feedbacks_org_idx on public.monetization_trail_feedbacks(organization_id);
create index if not exists monetization_trail_feedbacks_created_idx on public.monetization_trail_feedbacks(created_at);

-- RPC: enviar feedback e conceder bônus (opcional)
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
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select organization_id into v_org_id from public.saas_users where id = v_user_id;

  insert into public.monetization_trail_feedbacks (
    user_id, organization_id, completed_first_agent, guided_impl_rating, main_difficulties, liked_most, suggestions, bonus_requested
  ) values (
    v_user_id, v_org_id, coalesce(p_completed,false), nullif(p_rating,0), nullif(p_difficulties,''), nullif(p_liked,''), nullif(p_suggestions,''), coalesce(p_bonus_requested,false)
  ) returning id into v_row_id;

  -- Conceder bônus Pro 7 dias quando solicitado e marcado como concluído
  if coalesce(p_completed,false) = true and coalesce(p_bonus_requested,false) = true then
    select id into v_pro_plan_id from public.saas_plans where slug = 'professional' limit 1;
    if v_pro_plan_id is not null then
      -- Aplicar janela de 7 dias no Pro: setar plan_id para Pro e trial_ends_at para +7 dias
      update public.saas_users
        set plan_id = v_pro_plan_id,
            desired_plan = 'professional',
            trial_started_at = coalesce(trial_started_at, now()),
            trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + interval '7 days',
            updated_at = now()
        where id = v_user_id;

      -- Registrar assinatura trialing (idempotente por (user_id, plan_id, status='trialing'))
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


