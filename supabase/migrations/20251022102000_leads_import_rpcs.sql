-- RPCs for scalable leads import (start, stage_rows, commit, status)

create or replace function public.leads_import_start(p_organization_id uuid, p_filename text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare v_id uuid := gen_random_uuid();
begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  insert into public.crm_leads_import_jobs(id, organization_id, filename)
  values (v_id, p_organization_id, p_filename);
  return v_id;
end;
$$;

grant execute on function public.leads_import_start(uuid, text) to anon, authenticated;


create or replace function public.leads_import_stage_rows(p_organization_id uuid, p_import_id uuid, p_rows jsonb)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare v_count int;
begin
  perform set_config('app.organization_id', p_organization_id::text, true);

  insert into public.crm_leads_import_staging(
    import_id, organization_id, row_num, name, whatsapp, email, phone_normalized, email_normalized, stage, value, source, canal, description
  )
  select p_import_id,
         p_organization_id,
         coalesce((row->>'row_num')::int, null),
         nullif(trim(row->>'name'),''),
         nullif(trim(row->>'whatsapp'),''),
         nullif(trim(row->>'email'),''),
         public.normalize_phone_e164_br(row->>'whatsapp'),
         public.normalize_email(row->>'email'),
         coalesce(nullif(trim(row->>'stage'), ''), 'novo'),
         nullif(row->>'value','')::numeric,
         nullif(trim(row->>'source'),''),
         nullif(trim(row->>'canal'),''),
         nullif(trim(row->>'description'), '')
  from jsonb_array_elements(p_rows) row;

  get diagnostics v_count = row_count;
  update public.crm_leads_import_jobs
    set staged_rows = staged_rows + v_count,
        total_rows = greatest(total_rows, staged_rows + v_count)
  where id = p_import_id and organization_id = p_organization_id;
  return v_count;
end;
$$;

grant execute on function public.leads_import_stage_rows(uuid, uuid, jsonb) to anon, authenticated;


create or replace function public.leads_import_commit(p_organization_id uuid, p_import_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare v_lock_ok boolean;
begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  -- Lock por import para evitar concorrência
  v_lock_ok := pg_try_advisory_lock(hashtext('leads_import')::bigint, hashtext(p_import_id::text)::bigint);
  if not v_lock_ok then
    raise exception 'Import já em processamento';
  end if;

  update public.crm_leads_import_jobs
    set status='processing', started_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  -- Passo 1: insert por telefone normalizado (permite múltiplos leads com mesmo telefone)
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

  -- Passo 2: upsert por email normalizado (quando não há telefone)
  insert into public.crm_leads(
    id, organization_id, name, whatsapp, email, stage, value, source, canal, description
  )
  select gen_random_uuid(), s.organization_id,
         coalesce(nullif(s.name,''), 'Sem nome'),
         s.whatsapp, s.email, coalesce(nullif(s.stage,''), 'novo'), coalesce(s.value, 0), s.source, s.canal, s.description
  from public.crm_leads_import_staging s
  where s.import_id = p_import_id
    and s.organization_id = p_organization_id
    and s.phone_normalized is null
    and s.email_normalized is not null
  on conflict on constraint uniq_crm_leads_org_email do update set
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

  perform pg_advisory_unlock(hashtext('leads_import')::bigint, hashtext(p_import_id::text)::bigint);
  return jsonb_build_object('status','done');
exception when others then
  perform pg_advisory_unlock(hashtext('leads_import')::bigint, hashtext(p_import_id::text)::bigint);
  update public.crm_leads_import_jobs
    set status='failed', error=SQLERRM, finished_at=now()
  where id=p_import_id and organization_id=p_organization_id;
  raise;
end;
$$;

grant execute on function public.leads_import_commit(uuid, uuid) to anon, authenticated;


create or replace function public.leads_import_status(p_organization_id uuid, p_import_id uuid)
returns public.crm_leads_import_jobs
language sql security definer
set search_path = public
as $$
  select * from public.crm_leads_import_jobs where id=p_import_id and organization_id=p_organization_id;
$$;

grant execute on function public.leads_import_status(uuid, uuid) to anon, authenticated;


