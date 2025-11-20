-- v76 – Kanban sem limites e de alta performance
-- 1) Índices para paginação e agregações rápidas
-- 2) RPC de estatísticas do Kanban (conta/soma por organização)

begin;

-- Índices úteis para paginação por data e filtros comuns
create index if not exists idx_crm_leads_org_created_at
  on public.crm_leads(organization_id, created_at desc);

create index if not exists idx_crm_leads_org_stage
  on public.crm_leads(organization_id, stage);

create index if not exists idx_crm_leads_org_has_payment_true
  on public.crm_leads(organization_id)
  where has_payment is true;

create index if not exists idx_crm_leads_org_priority_high
  on public.crm_leads(organization_id)
  where priority = 'high';

create index if not exists idx_crm_leads_org_highlight
  on public.crm_leads(organization_id)
  where is_highlight is true;

-- RPC: Estatísticas do Kanban por organização
create or replace function public.kanban_leads_stats(p_organization_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_total bigint := 0;
  v_total_paid_value numeric := 0;
  v_high_priority bigint := 0;
  v_highlighted bigint := 0;
  v_with_payment bigint := 0;
  v_stage jsonb := '{}'::jsonb;
begin
  perform set_config('app.organization_id', p_organization_id::text, true);

  select count(*) into v_total from public.crm_leads where organization_id = p_organization_id;
  select coalesce(sum(payment_value), 0) into v_total_paid_value from public.crm_leads where organization_id = p_organization_id and has_payment is true;
  select count(*) into v_high_priority from public.crm_leads where organization_id = p_organization_id and priority = 'high';
  select count(*) into v_highlighted from public.crm_leads where organization_id = p_organization_id and is_highlight is true;
  select count(*) into v_with_payment from public.crm_leads where organization_id = p_organization_id and has_payment is true;

  select coalesce(jsonb_object_agg(coalesce(stage,'(sem estágio)'), cnt), '{}'::jsonb) into v_stage
  from (
    select stage, count(*)::bigint as cnt
    from public.crm_leads
    where organization_id = p_organization_id
    group by stage
  ) s;

  return jsonb_build_object(
    'total', v_total,
    'total_paid_value', v_total_paid_value,
    'high_priority', v_high_priority,
    'highlighted', v_highlighted,
    'with_payment', v_with_payment,
    'by_stage', v_stage
  );
end;
$$;

grant execute on function public.kanban_leads_stats(uuid) to anon, authenticated;

commit;

insert into public.app_migrations (version, applied_at)
values ('76', now())
on conflict (version) do nothing;


