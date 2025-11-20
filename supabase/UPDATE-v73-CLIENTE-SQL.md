-- v73 – Agenda: correção definitiva da criação de consultations ao marcar realizado

begin;

-- 1) Função resiliente: normaliza tipo e evita colidir com versões anteriores
create or replace function public.auto_create_consultation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
begin
  -- Cria consulta somente na transição para 'realizado'
  if NEW.status = 'realizado' and coalesce(OLD.status, '') <> 'realizado' then
    -- Normalização de tipo: aceita apenas ('consulta','retorno','exame')
    v_type := lower(coalesce(nullif(NEW.tipo, ''), 'consulta'));
    if v_type not in ('consulta','retorno','exame') then
      v_type := 'consulta';
    end if;

    insert into public.consultations (
      organization_id,
      appointment_id,
      client_id,
      collaborator_id,
      date,
      type,
      notes,
      status,
      created_at
    ) values (
      NEW.organization_id,
      NEW.id,
      NEW.client_id,
      NEW.collaborator_id,
      NEW.datetime,
      v_type,
      NEW.anotacoes,
      'completed',
      now()
    );
  end if;
  return NEW;
end;
$$;

-- 2) Trigger idempotente para a função
drop trigger if exists auto_consultation_trigger on public.appointments;
create trigger auto_consultation_trigger
after update on public.appointments
for each row execute function public.auto_create_consultation();

commit;

insert into public.app_migrations (version, applied_at)
values ('73', now())
on conflict (version) do nothing;

-- v73 – RPC org_me_progress_get: métricas de uso + onboarding por organização

begin;

set search_path = public, auth;

create or replace function public.org_me_progress_get(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid := p_organization_id;
  v_last_active_at timestamptz;
  v_features_used text[];
  v_onboarding_steps jsonb := '[]'::jsonb;
  v_onboarding_completed boolean := false;
  v_result jsonb;
begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  if v_user_id is null then
    return jsonb_build_object('error','not_authenticated');
  end if;

  -- Uso baseado em analytics_events por organização
  select max(e.ingested_at) into v_last_active_at
  from public.analytics_events e
  where e.organization_id = v_org_id
    and (e.user_id is null or e.user_id = v_user_id);

  select coalesce(array_agg(distinct e.feature_key), '{}') into v_features_used
  from public.analytics_events e
  where e.organization_id = v_org_id
    and (e.user_id is null or e.user_id = v_user_id)
    and e.feature_key is not null
    and e.ingested_at >= (now() - interval '30 days');

  -- Onboarding: usar tabela monetization_trail_progress (se existir) como proxy de onboarding
  begin
    v_onboarding_steps := coalesce((
      select jsonb_agg(jsonb_build_object(
        'step_key', p.step_key,
        'completed', p.completed,
        'updated_at', p.updated_at
      ) order by p.step_key)
      from public.monetization_trail_progress p
      where p.organization_id = v_org_id
    ), '[]'::jsonb);
    v_onboarding_completed := coalesce((
      select bool_and(p.completed) from public.monetization_trail_progress p where p.organization_id = v_org_id
    ), false);
  exception when undefined_table then
    -- tabela pode não existir em clientes antigos
    v_onboarding_steps := '[]'::jsonb;
    v_onboarding_completed := false;
  end;

  v_result := jsonb_build_object(
    'usage', jsonb_build_object(
      'dau', (select count(distinct e.user_id) from public.analytics_events e where e.organization_id = v_org_id and (e.user_id is null or e.user_id = v_user_id) and e.ingested_at >= (now() - interval '1 day')),
      'wau', (select count(distinct e.user_id) from public.analytics_events e where e.organization_id = v_org_id and (e.user_id is null or e.user_id = v_user_id) and e.ingested_at >= (now() - interval '7 days')),
      'mau', (select count(distinct e.user_id) from public.analytics_events e where e.organization_id = v_org_id and (e.user_id is null or e.user_id = v_user_id) and e.ingested_at >= (now() - interval '30 days')),
      'last_active_at', v_last_active_at,
      'features_used', coalesce(v_features_used, '{}')
    ),
    'onboarding', jsonb_build_object(
      'steps', v_onboarding_steps,
      'completed', v_onboarding_completed
    )
  );

  return v_result;
end;
$$;

grant execute on function public.org_me_progress_get(uuid) to authenticated, anon;

commit;

insert into public.app_migrations (version, applied_at)
values ('73', now())
on conflict (version) do nothing;


