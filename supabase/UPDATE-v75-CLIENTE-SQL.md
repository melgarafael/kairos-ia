-- v75 – Importação de Leads: aumentar statement_timeout e índices de staging

begin;

-- 1) Índices adicionais para acelerar DISTINCT ON e MERGE durante o commit
create index if not exists crm_leads_import_staging_phone_idx
  on public.crm_leads_import_staging(import_id, organization_id, phone_normalized)
  where phone_normalized is not null;

create index if not exists crm_leads_import_staging_email_idx
  on public.crm_leads_import_staging(import_id, organization_id, email_normalized)
  where email_normalized is not null;

-- 2) Aumentar o statement_timeout dentro da função de commit (operações pesadas)
create or replace function public.leads_import_commit(p_organization_id uuid, p_import_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
set statement_timeout = '600s'
as $$
declare
  v_lock_key text := 'leads_import:' || p_import_id::text;
  v_lock_ok boolean;
  v_email_strategy text := 'allow_duplicates';
begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  v_lock_ok := public.try_advisory_lock(v_lock_key);
  if not v_lock_ok then
    raise exception 'Import já em processamento';
  end if;

  select coalesce((select email_strategy from public.crm_import_prefs where organization_id=p_organization_id), 'allow_duplicates')
    into v_email_strategy;

  update public.crm_leads_import_jobs
    set status='processing', started_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  -- Passo 1: MERGE por telefone (único)
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

  -- Passo 2: EMAIL – estratégia padrão: permitir duplicados (dedupe só dentro do arquivo)
  if v_email_strategy = 'allow_duplicates' then
    with s_email as (
      select distinct on (s.organization_id, s.email_normalized)
             s.organization_id, coalesce(nullif(s.name,''), 'Sem nome') as name,
             s.whatsapp, s.email,
             coalesce(nullif(s.stage,''), 'novo') as stage,
             coalesce(s.value, 0) as value,
             s.source, s.canal, s.description
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
    select gen_random_uuid(), se.organization_id, se.name, se.whatsapp, se.email, se.stage, se.value, se.source, se.canal, se.description
    from s_email se;
  else
    -- update_if_exists: manter comportamento anterior (atualiza se já existir, senão insere)
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
    ), chosen as (
      select s.*, (
        select id from public.crm_leads t
        where t.organization_id = s.organization_id and t.email_normalized = s.email_normalized
        order by t.created_at asc, t.id asc limit 1
      ) as target_id
      from s_email s
    ), upd as (
      update public.crm_leads t
      set name = c.name, whatsapp = c.whatsapp, email = c.email, stage = c.stage, value = c.value,
          source = c.source, canal = c.canal, description = c.description, updated_at = now()
      from chosen c
      where c.target_id is not null and t.id = c.target_id
      returning c.email_normalized
    )
    insert into public.crm_leads(id, organization_id, name, whatsapp, email, stage, value, source, canal, description)
    select gen_random_uuid(), c.organization_id, c.name, c.whatsapp, c.email, c.stage, c.value, c.source, c.canal, c.description
    from chosen c
    where c.target_id is null;
  end if;

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
values ('75', now())
on conflict (version) do nothing;


