-- v81 – AI Agent Workflows: Tabela para armazenar fluxos de trabalho de agentes de IA
-- 
-- Esta migration cria a estrutura para que usuários possam desenhar e salvar
-- fluxos de trabalho para agentes de IA de atendimento e conversação.
--
-- Inspiração: Excalidraw, Whimsical, Miro
-- Design: Filosofia Apple (simplicidade, clareza, profundidade)

set search_path = public, auth;

BEGIN;

-- Tabela principal de workflows de agentes de IA
create table if not exists public.ai_agent_workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  
  -- Metadados básicos
  name text not null,
  description text,
  
  -- Dados do fluxograma (formato React Flow / XYFlow)
  -- nodes: array de nós do fluxograma
  -- edges: array de conexões entre nós
  -- viewport: posição e zoom do canvas
  workflow_data jsonb not null default '{
    "nodes": [],
    "edges": [],
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  }'::jsonb,
  
  -- Versão do workflow (para versionamento futuro)
  version integer not null default 1,
  
  -- Status e controle
  is_active boolean not null default true,
  is_template boolean not null default false, -- Templates podem ser compartilhados
  
  -- Categoria/tags para organização
  category text,
  tags text[] default '{}'::text[],
  
  -- Metadata adicional
  metadata jsonb default '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, -- Referência ao usuário que criou
  
  -- Constraints
  constraint ai_agent_workflows_name_check check (char_length(trim(name)) > 0),
  constraint ai_agent_workflows_version_check check (version > 0)
);

-- Índices para performance
create index if not exists ai_agent_workflows_org_id_idx 
  on public.ai_agent_workflows(organization_id);

create index if not exists ai_agent_workflows_org_active_idx 
  on public.ai_agent_workflows(organization_id, is_active) 
  where is_active = true;

create index if not exists ai_agent_workflows_category_idx 
  on public.ai_agent_workflows(organization_id, category) 
  where category is not null;

create index if not exists ai_agent_workflows_tags_idx 
  on public.ai_agent_workflows using gin(tags);

create index if not exists ai_agent_workflows_updated_at_idx 
  on public.ai_agent_workflows(updated_at desc);

-- Índice GIN para busca full-text no workflow_data
create index if not exists ai_agent_workflows_data_idx 
  on public.ai_agent_workflows using gin(workflow_data);

-- RLS (Row Level Security)
alter table public.ai_agent_workflows enable row level security;

-- Policy: usuários podem ver apenas workflows da sua organização
create policy ai_agent_workflows_select_policy
  on public.ai_agent_workflows
  for select
  using (
    organization_id = (current_setting('app.organization_id', true))::uuid
  );

-- Policy: usuários podem inserir workflows na sua organização
create policy ai_agent_workflows_insert_policy
  on public.ai_agent_workflows
  for insert
  with check (
    organization_id = (current_setting('app.organization_id', true))::uuid
  );

-- Policy: usuários podem atualizar workflows da sua organização
create policy ai_agent_workflows_update_policy
  on public.ai_agent_workflows
  for update
  using (
    organization_id = (current_setting('app.organization_id', true))::uuid
  )
  with check (
    organization_id = (current_setting('app.organization_id', true))::uuid
  );

-- Policy: usuários podem deletar workflows da sua organização
create policy ai_agent_workflows_delete_policy
  on public.ai_agent_workflows
  for delete
  using (
    organization_id = (current_setting('app.organization_id', true))::uuid
  );

-- Trigger para atualizar updated_at automaticamente
create or replace function public.ai_agent_workflows_update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger ai_agent_workflows_update_updated_at_trigger
  before update on public.ai_agent_workflows
  for each row
  execute function public.ai_agent_workflows_update_updated_at();

-- Função RPC para listar workflows (com contexto RLS)
create or replace function public.ai_agent_workflows_list(
  p_organization_id uuid,
  p_query text default null,
  p_category text default null,
  p_tags text[] default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns setof public.ai_agent_workflows
language plpgsql
as $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  
  return query
  select *
  from public.ai_agent_workflows
  where organization_id = p_organization_id
    and (
      p_query is null
      or p_query = ''
      or (
        name ilike '%' || p_query || '%'
        or coalesce(description, '') ilike '%' || p_query || '%'
        or coalesce(category, '') ilike '%' || p_query || '%'
      )
    )
    and (p_category is null or category = p_category)
    and (p_tags is null or tags && p_tags)
  order by updated_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;

grant execute on function public.ai_agent_workflows_list(uuid, text, text, text[], integer, integer) 
  to anon, authenticated;

-- Função RPC para criar/atualizar workflow
-- Remover versões antigas da função se existirem (com assinaturas diferentes)
drop function if exists public.ai_agent_workflows_upsert(uuid, uuid, text, text, jsonb, text, text[], boolean);
drop function if exists public.ai_agent_workflows_upsert(uuid, text, uuid, text, jsonb, text, text[], boolean);

create or replace function public.ai_agent_workflows_upsert(
  p_organization_id uuid,
  p_name text,
  p_id uuid default null,
  p_description text default null,
  p_workflow_data jsonb default null,
  p_category text default null,
  p_tags text[] default null,
  p_is_active boolean default true
)
returns public.ai_agent_workflows
language plpgsql
as $$
declare
  rec public.ai_agent_workflows;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  
  -- Se p_id for fornecido, atualiza; senão, cria novo
  if p_id is not null then
    update public.ai_agent_workflows
    set
      name = trim(p_name),
      description = nullif(trim(coalesce(p_description, '')), ''),
      workflow_data = coalesce(p_workflow_data, workflow_data),
      category = nullif(trim(coalesce(p_category, '')), ''),
      tags = coalesce(p_tags, tags),
      is_active = p_is_active,
      updated_at = now()
    where id = p_id
      and organization_id = p_organization_id
    returning * into rec;
    
    if rec.id is null then
      raise exception 'Workflow não encontrado ou sem permissão';
    end if;
  else
    insert into public.ai_agent_workflows (
      organization_id,
      name,
      description,
      workflow_data,
      category,
      tags,
      is_active
    ) values (
      p_organization_id,
      trim(p_name),
      nullif(trim(coalesce(p_description, '')), ''),
      coalesce(p_workflow_data, '{"nodes": [], "edges": [], "viewport": {"x": 0, "y": 0, "zoom": 1}}'::jsonb),
      nullif(trim(coalesce(p_category, '')), ''),
      coalesce(p_tags, '{}'::text[]),
      p_is_active
    )
    returning * into rec;
  end if;
  
  return rec;
end;
$$;

grant execute on function public.ai_agent_workflows_upsert(uuid, text, uuid, text, jsonb, text, text[], boolean) 
  to anon, authenticated;

-- Função RPC para deletar workflow
create or replace function public.ai_agent_workflows_delete(
  p_organization_id uuid,
  p_id uuid
)
returns boolean
language plpgsql
as $$
declare
  v_deleted int := 0;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  
  delete from public.ai_agent_workflows
  where id = p_id
    and organization_id = p_organization_id;
  
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

grant execute on function public.ai_agent_workflows_delete(uuid, uuid) 
  to anon, authenticated;

COMMIT;

-- Marcar versão
insert into public.app_migrations (version, applied_at)
values ('81', now())
on conflict (version) do nothing;

