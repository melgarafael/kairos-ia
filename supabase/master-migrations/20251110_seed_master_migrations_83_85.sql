-- Seed a subset of canonical migrations into master_migrations (v83 → v85)
-- These are used by the Edge Function check-and-apply-migrations to update clients.

set search_path = public;

create table if not exists public.master_migrations (
  version int primary key,
  name text not null,
  sql text not null,
  created_at timestamptz not null default now()
);

-- v83
insert into public.master_migrations(version, name, sql)
values (
  83,
  'v83 – AI Agent Metrics: add cliente_messages',
  $$-- Add cliente_messages field to ai_agent_metrics_summary function
-- This allows calculating average messages per user using only cliente messages

-- Drop existing function first since we're changing the return type
drop function if exists public.ai_agent_metrics_summary(uuid, timestamptz, timestamptz);

-- Create the function with the new return type
create function public.ai_agent_metrics_summary(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  total_messages bigint,
  human_messages bigint,
  cliente_messages bigint,
  users_attended bigint
)
language sql
stable
as $fn$
  select
    count(*) as total_messages,
    count(*) filter (where sender_type in ('cliente','humano')) as human_messages,
    count(*) filter (where sender_type = 'cliente') as cliente_messages,
    count(distinct whatsapp_cliente) as users_attended
  from public.repositorio_de_mensagens
  where organization_id = p_org
    and created_at >= p_from
    and created_at <= p_to;
$fn$;

comment on function public.ai_agent_metrics_summary is 'Window summary: total messages, human messages, cliente messages, and distinct whatsapp_cliente count for the organization.';
$$
)
on conflict (version) do update set name = excluded.name, sql = excluded.sql;

-- v84
insert into public.master_migrations(version, name, sql)
values (
  84,
  'v84 – Remove unique phone constraint; adjust import commit',
  $$-- v84 – Remove constraint única de telefone para permitir múltiplos leads com mesmo telefone

begin;

-- 1) Remover índice único em phone_normalized
drop index if exists public.uniq_crm_leads_org_phone;

-- 2) Criar índice não-único para performance (consultas por telefone)
create index if not exists idx_crm_leads_org_phone
  on public.crm_leads(organization_id, phone_normalized)
  where phone_normalized is not null;

-- 3) Atualizar leads_import_commit para remover ON CONFLICT de telefone (permite duplicatas)
create or replace function public.leads_import_commit(p_organization_id uuid, p_import_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $fn$
declare v_lock_key text := 'leads_import:' || p_import_id::text; v_lock_ok boolean;
begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  v_lock_ok := public.try_advisory_lock(v_lock_key);
  if not v_lock_ok then
    raise exception 'Import já em processamento';
  end if;

  update public.crm_leads_import_jobs
    set status='processing', started_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  -- 1) INSERT por telefone (sem deduplicação - permite múltiplos leads com mesmo telefone)
  insert into public.crm_leads(
    id, organization_id, name, whatsapp, email, stage, value, source, canal, description
  )
  select gen_random_uuid(), s.organization_id,
         coalesce(nullif(s.name,''), 'Sem nome'),
         s.whatsapp, s.email, coalesce(nullif(s.stage,''), 'novo'), coalesce(s.value, 0), s.source, s.canal, s.description
  from public.crm_leads_import_staging s
  where s.import_id = p_import_id
    and s.organization_id = p_organization_id
    and s.phone_normalized is not null;

  -- 2) UPSERT por email (mantém deduplicação por email quando não há telefone)
  with s_email as (
    select distinct on (s.organization_id, s.email_normalized)
           s.organization_id, s.name, s.whatsapp, s.email, s.stage, s.value, s.source, s.canal, s.description,
           s.email_normalized
    from public.crm_leads_import_staging s
    where s.import_id = p_import_id
      and s.organization_id = p_organization_id
      and s.phone_normalized is null
      and s.email_normalized is not null
    order by s.organization_id, s.email_normalized, coalesce(s.row_num, 0) desc, s.created_at desc
  )
  insert into public.crm_leads(
    id, organization_id, name, whatsapp, email, stage, value, source, canal, description
  )
  select gen_random_uuid(), se.organization_id,
         coalesce(nullif(se.name,''), 'Sem nome'),
         se.whatsapp, se.email, coalesce(nullif(se.stage,''), 'novo'), coalesce(se.value, 0), se.source, se.canal, se.description
  from s_email se
  on conflict (organization_id, email_normalized)
    where email_normalized is not null
  do update set
    name = excluded.name,
    whatsapp = excluded.whatsapp,
    email = excluded.email,
    stage = excluded.stage,
    value = excluded.value,
    source = excluded.source,
    canal = excluded.canal,
    description = excluded.description,
    updated_at = now();

  update public.crm_leads_import_jobs
    set processed_rows = (select count(*) from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id),
        status='done',
        finished_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  delete from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id;

  perform public.advisory_unlock(v_lock_key);
  return jsonb_build_object('status','done');
exception when others then
  perform public.advisory_unlock(v_lock_key);
  update public.crm_leads_import_jobs
    set status='failed', error=SQLERRM, finished_at=now()
  where id=p_import_id and organization_id=p_organization_id;
  raise;
end;
$fn$;

grant execute on function public.leads_import_commit(uuid, uuid) to anon, authenticated;

commit;
$$
)
on conflict (version) do update set name = excluded.name, sql = excluded.sql;

-- v85
insert into public.master_migrations(version, name, sql)
values (
  85,
  'v85 – RPC crm_leads_reorder_stage',
  $$-- v85 – RPC para Reordenar Leads em Estágio (crm_leads_reorder_stage)
-- Objetivo:
--  1) Criar RPC que reordena todos os leads de um estágio sequencialmente
--  2) Garantir que stage_order seja único e sequencial (0, 1, 2, 3...) sem conflitos
--  3) Resolver problema de reordenação onde apenas um lead era atualizado, causando conflitos

begin;

-- RPC para reordenar leads em um estágio após mover um lead
-- Garante que stage_order seja sequencial (0, 1, 2, 3...) sem conflitos
CREATE OR REPLACE FUNCTION public.crm_leads_reorder_stage(
  p_organization_id uuid,
  p_stage text,
  p_lead_ids uuid[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  v_lead_id uuid;
  v_order integer := 0;
BEGIN
  -- Validar que todos os leads pertencem à organização e ao estágio
  IF NOT EXISTS (
    SELECT 1 FROM public.crm_leads
    WHERE organization_id = p_organization_id
      AND stage = p_stage
      AND id = ANY(p_lead_ids)
    HAVING COUNT(*) = array_length(p_lead_ids, 1)
  ) THEN
    RAISE EXCEPTION 'Nem todos os leads pertencem à organização e estágio especificados';
  END IF;

  -- Atualizar stage_order sequencialmente para cada lead na ordem especificada
  FOREACH v_lead_id IN ARRAY p_lead_ids
  LOOP
    UPDATE public.crm_leads
    SET stage_order = v_order,
        updated_at = now()
    WHERE id = v_lead_id
      AND organization_id = p_organization_id
      AND stage = p_stage;
    
    v_order := v_order + 1;
  END LOOP;

  RETURN true;
END;
$fn$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.crm_leads_reorder_stage(uuid, text, uuid[]) TO authenticated, anon;

COMMENT ON FUNCTION public.crm_leads_reorder_stage IS 
  'Reordena leads em um estágio específico, garantindo stage_order sequencial sem conflitos. Usado após drag-and-drop no Kanban.';

commit;
$$
)
on conflict (version) do update set name = excluded.name, sql = excluded.sql;


