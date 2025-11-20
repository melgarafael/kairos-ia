-- v69 – Commit com MERGE (Postgres 15): idempotente e sem violações únicas

begin;

-- Garantir índices únicos (idempotente)
create unique index if not exists uniq_crm_leads_org_phone
  on public.crm_leads(organization_id, phone_normalized)
  where phone_normalized is not null;

create unique index if not exists uniq_crm_leads_org_email
  on public.crm_leads(organization_id, email_normalized)
  where email_normalized is not null;

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

  -- 1) PHONE: fonte deduplicada
  with s_phone as (
    select distinct on (s.organization_id, s.phone_normalized)
           s.organization_id, coalesce(nullif(s.name,''), 'Sem nome') as name,
           s.whatsapp, s.email,
           coalesce(nullif(s.stage,''), 'novo') as stage,
           coalesce(s.value, 0) as value,
           s.source, s.canal, s.description,
           s.phone_normalized
    from public.crm_leads_import_staging s
    where s.import_id = p_import_id
      and s.organization_id = p_organization_id
      and s.phone_normalized is not null
    order by s.organization_id, s.phone_normalized, coalesce(s.row_num, 0) desc, s.created_at desc
  )
  merge into public.crm_leads t
  using s_phone s
  on (t.organization_id = s.organization_id and t.phone_normalized = s.phone_normalized)
  when matched then update set
    name = s.name,
    whatsapp = s.whatsapp,
    email = s.email,
    stage = s.stage,
    value = s.value,
    source = s.source,
    canal = s.canal,
    description = s.description,
    updated_at = now()
  when not matched then insert (
    id, organization_id, name, whatsapp, email, stage, value, source, canal, description
  ) values (
    gen_random_uuid(), s.organization_id, s.name, s.whatsapp, s.email, s.stage, s.value, s.source, s.canal, s.description
  );

  -- 2) EMAIL: fonte deduplicada (somente registros sem phone_normalized)
  with s_email as (
    select distinct on (s.organization_id, s.email_normalized)
           s.organization_id, coalesce(nullif(s.name,''), 'Sem nome') as name,
           s.whatsapp, s.email,
           coalesce(nullif(s.stage,''), 'novo') as stage,
           coalesce(s.value, 0) as value,
           s.source, s.canal, s.description,
           s.email_normalized
    from public.crm_leads_import_staging s
    where s.import_id = p_import_id
      and s.organization_id = p_organization_id
      and s.phone_normalized is null
      and s.email_normalized is not null
    order by s.organization_id, s.email_normalized, coalesce(s.row_num, 0) desc, s.created_at desc
  )
  merge into public.crm_leads t
  using s_email s
  on (t.organization_id = s.organization_id and t.email_normalized = s.email_normalized)
  when matched then update set
    name = s.name,
    whatsapp = s.whatsapp,
    email = s.email,
    stage = s.stage,
    value = s.value,
    source = s.source,
    canal = s.canal,
    description = s.description,
    updated_at = now()
  when not matched then insert (
    id, organization_id, name, whatsapp, email, stage, value, source, canal, description
  ) values (
    gen_random_uuid(), s.organization_id, s.name, s.whatsapp, s.email, s.stage, s.value, s.source, s.canal, s.description
  );

  update public.crm_leads_import_jobs
    set processed_rows = (select count(*) from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id),
        status='done', finished_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  delete from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id;

  perform public.advisory_unlock(v_lock_key);
  return jsonb_build_object('status','done');
exception when others then
  perform public.advisory_unlock(v_lock_key);
  update public.crm_leads_import_jobs set status='failed', error=SQLERRM, finished_at=now() where id=p_import_id and organization_id=p_organization_id;
  raise;
end;
$$;

grant execute on function public.leads_import_commit(uuid, uuid) to anon, authenticated;

commit;

insert into public.app_migrations (version, applied_at)
values ('69', now())
on conflict (version) do nothing;


