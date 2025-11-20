-- v63 – Importação escalável de Leads (staging + commit + dedupe)

begin;

-- Funções de normalização
create or replace function public.normalize_email(p text) returns text
language sql immutable as $$ select case when p is null then null else lower(trim(p)) end $$;

create or replace function public.normalize_phone_e164_br(p text) returns text
language plpgsql immutable as $$
declare d text; begin
  if p is null then return null; end if;
  d := regexp_replace(p, '\\D', '', 'g');
  if length(d)=11 and left(d,2) <> '55' then d := '55'||d; end if;
  if length(d)>=10 then return '+'||d; end if;
  return null;
end $$;

-- Colunas geradas em crm_leads
alter table if exists public.crm_leads
  add column if not exists phone_normalized text generated always as (public.normalize_phone_e164_br(whatsapp)) stored,
  add column if not exists email_normalized text generated always as (public.normalize_email(email)) stored;

-- Deduplicação defensiva (prioridade telefone)
with d as (
  select id, row_number() over (partition by organization_id, phone_normalized order by updated_at desc, created_at desc, id desc) as rn
  from public.crm_leads where phone_normalized is not null
)
delete from public.crm_leads l using d where l.id=d.id and d.rn>1;

with d as (
  select id, row_number() over (partition by organization_id, email_normalized order by updated_at desc, created_at desc, id desc) as rn
  from public.crm_leads where email_normalized is not null
)
delete from public.crm_leads l using d where l.id=d.id and d.rn>1;

-- Índices
create unique index if not exists uniq_crm_leads_org_phone on public.crm_leads(organization_id, phone_normalized) where phone_normalized is not null;
create unique index if not exists uniq_crm_leads_org_email on public.crm_leads(organization_id, email_normalized) where email_normalized is not null;
create index if not exists crm_leads_org_created_at_idx on public.crm_leads(organization_id, created_at desc);

-- Staging UNLOGGED e jobs
create unlogged table if not exists public.crm_leads_import_staging (
  import_id uuid not null,
  organization_id uuid not null,
  row_num int,
  name text,
  whatsapp text,
  email text,
  phone_normalized text,
  email_normalized text,
  stage text,
  value numeric(10,2),
  source text,
  canal text,
  description text,
  created_at timestamptz default now()
);
create index if not exists crm_leads_import_staging_idx on public.crm_leads_import_staging(import_id, organization_id);

create table if not exists public.crm_leads_import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.saas_organizations(id) on delete cascade,
  filename text,
  total_rows int default 0,
  staged_rows int default 0,
  processed_rows int default 0,
  duplicate_rows int default 0,
  invalid_rows int default 0,
  status text not null default 'staging',
  error text,
  created_at timestamptz default now(),
  started_at timestamptz,
  finished_at timestamptz
);

-- RPCs
create or replace function public.leads_import_start(p_organization_id uuid, p_filename text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid := gen_random_uuid(); begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  insert into public.crm_leads_import_jobs(id, organization_id, filename) values (v_id, p_organization_id, p_filename);
  return v_id; end $$;
grant execute on function public.leads_import_start(uuid, text) to anon, authenticated;

create or replace function public.leads_import_stage_rows(p_organization_id uuid, p_import_id uuid, p_rows jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare v_count int; begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  insert into public.crm_leads_import_staging(import_id, organization_id, row_num, name, whatsapp, email, phone_normalized, email_normalized, stage, value, source, canal, description)
  select p_import_id, p_organization_id,
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
  update public.crm_leads_import_jobs set staged_rows = staged_rows + v_count, total_rows = greatest(total_rows, staged_rows + v_count)
  where id = p_import_id and organization_id = p_organization_id;
  return v_count; end $$;
grant execute on function public.leads_import_stage_rows(uuid, uuid, jsonb) to anon, authenticated;

create or replace function public.leads_import_commit(p_organization_id uuid, p_import_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_lock_ok boolean; begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  v_lock_ok := pg_try_advisory_lock(hashtext('leads_import')::bigint, hashtext(p_import_id::text)::bigint);
  if not v_lock_ok then raise exception 'Import já em processamento'; end if;
  update public.crm_leads_import_jobs set status='processing', started_at=now() where id=p_import_id and organization_id=p_organization_id;

  insert into public.crm_leads(id, organization_id, name, whatsapp, email, stage, value, source, canal, description)
  select gen_random_uuid(), s.organization_id, coalesce(nullif(s.name,''), 'Sem nome'), s.whatsapp, s.email, coalesce(nullif(s.stage,''), 'novo'), coalesce(s.value, 0), s.source, s.canal, s.description
  from public.crm_leads_import_staging s
  where s.import_id = p_import_id and s.organization_id = p_organization_id and s.phone_normalized is not null
  on conflict on constraint uniq_crm_leads_org_phone do update set
    name = excluded.name, whatsapp = excluded.whatsapp, email = excluded.email, stage = excluded.stage,
    value = excluded.value, source = excluded.source, canal = excluded.canal, description = excluded.description, updated_at = now();

  insert into public.crm_leads(id, organization_id, name, whatsapp, email, stage, value, source, canal, description)
  select gen_random_uuid(), s.organization_id, coalesce(nullif(s.name,''), 'Sem nome'), s.whatsapp, s.email, coalesce(nullif(s.stage,''), 'novo'), coalesce(s.value, 0), s.source, s.canal, s.description
  from public.crm_leads_import_staging s
  where s.import_id = p_import_id and s.organization_id = p_organization_id and s.phone_normalized is null and s.email_normalized is not null
  on conflict on constraint uniq_crm_leads_org_email do update set
    name = excluded.name, whatsapp = excluded.whatsapp, email = excluded.email, stage = excluded.stage,
    value = excluded.value, source = excluded.source, canal = excluded.canal, description = excluded.description, updated_at = now();

  update public.crm_leads_import_jobs set processed_rows = (select count(*) from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id), status='done', finished_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  delete from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id;
  perform pg_advisory_unlock(hashtext('leads_import')::bigint, hashtext(p_import_id::text)::bigint);
  return jsonb_build_object('status','done');
exception when others then
  perform pg_advisory_unlock(hashtext('leads_import')::bigint, hashtext(p_import_id::text)::bigint);
  update public.crm_leads_import_jobs set status='failed', error=SQLERRM, finished_at=now() where id=p_import_id and organization_id=p_organization_id;
  raise; end $$;
grant execute on function public.leads_import_commit(uuid, uuid) to anon, authenticated;

create or replace function public.leads_import_status(p_organization_id uuid, p_import_id uuid)
returns public.crm_leads_import_jobs language sql security definer set search_path=public as $$
  select * from public.crm_leads_import_jobs where id=p_import_id and organization_id=p_organization_id; $$;
grant execute on function public.leads_import_status(uuid, uuid) to anon, authenticated;

commit;

-- Marcar versão
insert into public.app_migrations (version, applied_at) values ('63', now()) on conflict (version) do nothing;


