BEGIN;

-- v65 – Normalização defensiva para UUID/inteiros em crm_leads_upsert (aceitar "" do n8n)

-- 1) Helpers idempotentes para converter strings vazias em NULL
create or replace function public.uuid_or_null(p_text text)
returns uuid
language plpgsql immutable as $$
declare v text; begin
  if p_text is null then return null; end if;
  v := nullif(trim(p_text), '');
  if v is null then return null; end if;
  begin
    return v::uuid;
  exception when others then
    return null; -- se não for uuid válido, retorna NULL
  end;
end $$;

create or replace function public.int_or_null(p_text text)
returns int
language plpgsql immutable as $$
declare v text; begin
  if p_text is null then return null; end if;
  v := nullif(trim(p_text), '');
  if v is null then return null; end if;
  begin
    return v::int;
  exception when others then
    return null; -- se não for inteiro válido, retorna NULL
  end;
end $$;

-- 2) Remover versões anteriores da RPC para re-criar com parâmetros text nos campos problemáticos
do $$
declare r record;
begin
  for r in (
    select p.oid, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'crm_leads_upsert'
  ) loop
    execute format('drop function if exists public.crm_leads_upsert(%s);', r.args);
  end loop;
end $$;

-- 3) Recriar crm_leads_upsert aceitando strings vazias para sold_/interest_ via TEXT
create or replace function public.crm_leads_upsert(
  p_organization_id uuid,
  p_name text,
  p_id uuid default null,
  p_whatsapp text default null,
  p_email text default null,
  p_instagram_username text default null,
  p_stage text default null,
  p_value numeric(10,2) default 0,
  p_priority text default 'medium',
  p_source text default null,
  p_canal text default null,
  p_has_payment boolean default false,
  p_payment_value numeric(10,2) default 0,
  p_sold_produto_servico_id text default null, -- ALTERADO p/ text
  p_sold_quantity text default null,           -- ALTERADO p/ text
  p_interest_produto_servico_id text default null, -- ALTERADO p/ text
  p_interest_quantity text default null,           -- ALTERADO p/ text
  p_custom_fields jsonb default '{}'::jsonb,
  p_created_at timestamptz default null,
  p_updated_at timestamptz default null
)
returns public.crm_leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stage text;
  rec public.crm_leads;
  v_sold_ps uuid := public.uuid_or_null(p_sold_produto_servico_id);
  v_sold_qty int := coalesce(greatest(public.int_or_null(p_sold_quantity), 1), null);
  v_interest_ps uuid := public.uuid_or_null(p_interest_produto_servico_id);
  v_interest_qty int := coalesce(greatest(public.int_or_null(p_interest_quantity), 1), null);
begin
  -- Contexto de organização (mesma sessão)
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);

  -- Normalização de stage para o name exato da organização (case-insensitive)
  if p_stage is not null and trim(p_stage) <> '' then
    select s.name into v_stage
    from public.crm_stages s
    where s.organization_id = p_organization_id
      and lower(s.name) = lower(p_stage)
    limit 1;
  end if;

  if v_stage is null and (p_stage is null or trim(p_stage) = '') then
    v_stage := null;
  end if;

  if p_id is null then
    insert into public.crm_leads (
      organization_id, name, whatsapp, email, instagram_username, stage,
      description, value, priority, source, canal,
      has_payment, payment_value, sold_produto_servico_id, sold_quantity,
      interest_produto_servico_id, interest_quantity, custom_fields,
      created_at, updated_at
    ) values (
      p_organization_id,
      trim(coalesce(p_name, '')),
      nullif(trim(coalesce(p_whatsapp, '')), ''),
      nullif(trim(coalesce(p_email, '')), ''),
      nullif(trim(coalesce(p_instagram_username, '')), ''),
      coalesce(v_stage, null),
      null,
      coalesce(p_value, 0),
      coalesce(nullif(trim(p_priority), ''), 'medium'),
      nullif(trim(coalesce(p_source, '')), ''),
      nullif(trim(coalesce(p_canal, '')), ''),
      coalesce(p_has_payment, false),
      coalesce(p_payment_value, 0),
      v_sold_ps,
      case when v_sold_ps is null then null else coalesce(v_sold_qty, 1) end,
      v_interest_ps,
      case when v_interest_ps is null then null else coalesce(v_interest_qty, 1) end,
      coalesce(p_custom_fields, '{}'::jsonb),
      coalesce(p_created_at, now()),
      coalesce(p_updated_at, now())
    ) returning * into rec;
  else
    update public.crm_leads set
      name = trim(coalesce(p_name, name)),
      whatsapp = coalesce(nullif(trim(coalesce(p_whatsapp, '')), ''), whatsapp),
      email = coalesce(nullif(trim(coalesce(p_email, '')), ''), email),
      instagram_username = coalesce(nullif(trim(coalesce(p_instagram_username, '')), ''), instagram_username),
      stage = coalesce(v_stage, stage),
      value = coalesce(p_value, value),
      priority = coalesce(nullif(trim(p_priority), ''), priority),
      source = coalesce(nullif(trim(coalesce(p_source, '')), ''), source),
      canal = coalesce(nullif(trim(coalesce(p_canal, '')), ''), canal),
      has_payment = coalesce(p_has_payment, has_payment),
      payment_value = coalesce(p_payment_value, payment_value),
      sold_produto_servico_id = coalesce(v_sold_ps, sold_produto_servico_id),
      sold_quantity = case
        when coalesce(v_sold_ps, sold_produto_servico_id) is null then null
        else greatest(coalesce(v_sold_qty, sold_quantity, 1), 1)
      end,
      interest_produto_servico_id = coalesce(v_interest_ps, interest_produto_servico_id),
      interest_quantity = case
        when coalesce(v_interest_ps, interest_produto_servico_id) is null then null
        else greatest(coalesce(v_interest_qty, interest_quantity, 1), 1)
      end,
      custom_fields = coalesce(p_custom_fields, custom_fields),
      updated_at = coalesce(p_updated_at, now())
    where id = p_id and organization_id = p_organization_id
    returning * into rec;
  end if;

  return rec;
end;
$$;

-- 4) Grants
do $$ begin
  grant execute on function public.crm_leads_upsert(
    uuid, text, uuid, text, text, text, text, numeric, text, text, text, boolean, numeric, text, text, text, text, jsonb, timestamptz, timestamptz
  ) to anon, authenticated;
exception when others then null; end $$;

COMMIT;

insert into public.app_migrations (version, applied_at)
values ('65', now())
on conflict (version) do nothing;


