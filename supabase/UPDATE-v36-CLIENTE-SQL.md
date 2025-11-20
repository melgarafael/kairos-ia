-- v36 – RAG datasets e embeddings (pgvector)

-- 0) Extensão pgvector (idempotente)
create extension if not exists vector;

-- 1) Função utilitária para setar organization_id a partir do contexto
create or replace function public.rag_set_org_from_context()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    begin
      new.organization_id := nullif(current_setting('app.organization_id', true), '')::uuid;
    exception when others then
      new.organization_id := new.organization_id;
    end;
  end if;
  return new;
end;
$$;

-- 2) Tabela de fontes (um dataset por upload)
create table if not exists public.rag_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  name text not null,
  storage_path text not null,
  mime_type text,
  status text not null default 'pending', -- pending|processing|ready|failed
  total_rows integer default 0,
  processed_rows integer default 0,
  schema_json jsonb,
  created_by uuid,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger para preencher organization_id
drop trigger if exists trg_rag_sources_set_org_from_context on public.rag_sources;
create trigger trg_rag_sources_set_org_from_context
before insert on public.rag_sources
for each row execute function public.rag_set_org_from_context();

-- 3) Itens/chunks (texto + embedding)
create table if not exists public.rag_items (
  id bigserial primary key,
  organization_id uuid,
  source_id uuid not null references public.rag_sources(id) on delete cascade,
  row_index integer,
  category text,
  content text not null,
  fields jsonb,
  metadata jsonb,
  hash text unique,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

-- Trigger para preencher organization_id nos itens
drop trigger if exists trg_rag_items_set_org_from_context on public.rag_items;
create trigger trg_rag_items_set_org_from_context
before insert on public.rag_items
for each row execute function public.rag_set_org_from_context();

-- 4) Índices úteis
create index if not exists rag_sources_org_idx on public.rag_sources (organization_id);
create index if not exists rag_items_org_idx on public.rag_items (organization_id);
create index if not exists rag_items_source_idx on public.rag_items (source_id);
create index if not exists rag_items_category_idx on public.rag_items (category);
create index if not exists rag_items_embedding_ivfflat on public.rag_items using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- 5) RLS por organização
alter table public.rag_sources enable row level security;
alter table public.rag_items enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='rag_sources' and policyname='rag_sources_select_by_org'
  ) then
    create policy rag_sources_select_by_org on public.rag_sources
      for select to authenticated
      using (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='rag_sources' and policyname='rag_sources_insert_by_org'
  ) then
    create policy rag_sources_insert_by_org on public.rag_sources
      for insert to authenticated
      with check (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='rag_sources' and policyname='rag_sources_update_by_org'
  ) then
    create policy rag_sources_update_by_org on public.rag_sources
      for update to authenticated
      using (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      ) with check (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='rag_items' and policyname='rag_items_select_by_org'
  ) then
    create policy rag_items_select_by_org on public.rag_items
      for select to authenticated
      using (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='rag_items' and policyname='rag_items_insert_by_org'
  ) then
    create policy rag_items_insert_by_org on public.rag_items
      for insert to authenticated
      with check (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='rag_items' and policyname='rag_items_update_by_org'
  ) then
    create policy rag_items_update_by_org on public.rag_items
      for update to authenticated
      using (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      ) with check (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      );
  end if;
end $$;

-- 6) RPC de similaridade (usa organization_id do contexto por padrão)
drop function if exists public.match_rag(vector, uuid, text, int, uuid);
create or replace function public.match_rag(
  p_query_embedding vector(1536),
  p_source_id uuid default null,
  p_category text default null,
  p_limit int default 10,
  p_org uuid default null
)
returns table (
  id bigint,
  source_id uuid,
  category text,
  content text,
  fields jsonb,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    ri.id,
    ri.source_id,
    ri.category,
    ri.content,
    ri.fields,
    ri.metadata,
    1 - (ri.embedding <=> p_query_embedding) as similarity
  from public.rag_items ri
  where ri.embedding is not null
    and (
      ri.organization_id = coalesce(p_org, nullif(current_setting('app.organization_id', true), '')::uuid)
    )
    and (p_source_id is null or ri.source_id = p_source_id)
    and (p_category is null or ri.category = p_category)
  order by ri.embedding <=> p_query_embedding
  limit greatest(1, p_limit);
$$;

-- 7) Marcar versão
insert into public.app_migrations (version, applied_at)
values ('36', now())
on conflict (version) do nothing;

-- Comentários
comment on table public.rag_sources is 'Datasets enviados pelo usuário (CSV/XLSX/TXT) para RAG';
comment on table public.rag_items is 'Linhas/chunks normalizados com embedding para busca semântica';
comment on function public.match_rag is 'Busca por similaridade (cosine) em rag_items com filtros opcionais';


