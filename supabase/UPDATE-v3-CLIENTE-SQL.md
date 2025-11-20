/*
  CRM Stage Normalization
  - Aliases por organização
  - Função normalize_stage_name
  - Trigger BEFORE INSERT/UPDATE em crm_leads
  - Backfill inicial de sinônimos óbvios
*/

-- 1) Tabela de aliases por organização
create table if not exists public.crm_stage_aliases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.saas_organizations(id) on delete cascade,
  alias text not null,
  canonical text not null, -- valores canônicos: novo, contato, proposta, negociacao, fechado, perdido
  created_at timestamptz default now(),
  unique (organization_id, alias)
);

-- 2) Função de normalização
create or replace function public.normalize_stage_name(p_org uuid, p_raw text)
returns text
language plpgsql
as $$
declare
  v_raw text := coalesce(trim(lower(p_raw)), '');
  v_result text := null;
begin
  if v_raw = '' then
    return 'novo';
  end if;

  -- a) tenta achar em aliases
  select a.canonical into v_result
  from public.crm_stage_aliases a
  where a.organization_id = p_org and a.alias = v_raw
  limit 1;

  if v_result is not null then
    return v_result;
  end if;

  -- b) dicionário padrão
  if v_raw in ('novo','novo lead','topo','inicio','início') then
    return 'novo';
  elseif v_raw in ('contato','contato inicial','em contato') then
    return 'contato';
  elseif v_raw in ('proposta','proposta enviada') then
    return 'proposta';
  elseif v_raw in ('negociacao','negociação','em negociacao','em negociação') then
    return 'negociacao';
  elseif v_raw in ('fechado','fechado ganho','ganho','venda fechada') then
    return 'fechado';
  elseif v_raw in ('perdido','fechado perdido','venda perdida') then
    return 'perdido';
  end if;

  -- c) fallback: mantém value em minúsculas (evita nulo)
  return v_raw;
end;
$$;

-- 3) Trigger
create or replace function public.trg_crm_leads_normalize_stage()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.stage := public.normalize_stage_name(new.organization_id, new.stage);
  elsif tg_op = 'UPDATE' then
    if new.stage is distinct from old.stage then
      new.stage := public.normalize_stage_name(new.organization_id, new.stage);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_crm_leads_normalize_stage on public.crm_leads;
create trigger trg_crm_leads_normalize_stage
before insert or update on public.crm_leads
for each row execute function public.trg_crm_leads_normalize_stage();

-- 4) Backfill de dados existentes (idempotente)
update public.crm_leads l
set stage = public.normalize_stage_name(l.organization_id, l.stage)
where true;

-- v3 - CRM Stage Normalization (aliases, function, trigger, backfill)
insert into public.app_migrations (version, applied_at)
values ('3', now())
on conflict (version) do nothing;