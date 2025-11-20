-- Remove unique constraint on phone_normalized to allow duplicate phones per organization
-- This allows multiple leads to have the same phone number

begin;

-- 1) Drop the unique index on phone_normalized
drop index if exists public.uniq_crm_leads_org_phone;

-- 2) Create a non-unique index for performance (queries by phone)
create index if not exists idx_crm_leads_org_phone
  on public.crm_leads(organization_id, phone_normalized)
  where phone_normalized is not null;

-- 3) Update leads_import_commit to remove ON CONFLICT for phone (allow duplicates)
create or replace function public.leads_import_commit(p_organization_id uuid, p_import_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
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
$$;

grant execute on function public.leads_import_commit(uuid, uuid) to anon, authenticated;

commit;

