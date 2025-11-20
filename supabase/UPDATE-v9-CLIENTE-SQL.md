-- Repositório de Mensagens de WhatsApp (cliente)
-- Objetivo: armazenar mensagens recebidas/enviadas (cliente, IA, humano) com filtros, FT e pronto para RAG

-- Extensões necessárias (idempotentes)
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists vector;

-- Enums idempotentes
do $$ begin
  create type sender_type as enum ('cliente','ia','humano');
exception when duplicate_object then null; end $$;

do $$ begin
  create type msg_direction as enum ('inbound','outbound');
exception when duplicate_object then null; end $$;

-- Tabela principal
create table if not exists public.repositorio_de_mensagens (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  whatsapp_cliente text not null,
  whatsapp_empresa text not null,
  sender_type sender_type not null,
  direction msg_direction not null,
  content_text text,
  content_raw jsonb,
  has_media boolean default false,
  media_type text,
  media_url text,
  media_size_bytes integer,
  provider text,
  provider_message_id text,
  thread_id text,
  conversation_id text generated always as (
    md5(lower(coalesce(whatsapp_cliente,'')) || '|' || lower(coalesce(whatsapp_empresa,'')))
  ) stored,
  reply_to_provider_message_id text,
  language text,
  labels text[] default '{}',
  ai_model text,
  ai_agent_id text,
  human_operator_id text,
  tsv tsvector generated always as (
    setweight(to_tsvector('portuguese', coalesce(content_text,'')), 'A')
  ) stored,
  embedding vector(1536)
);

-- Unicidade por mensagem do provedor (ignora nulos)
create unique index if not exists repositorio_de_mensagens_provider_message_id_uk
  on public.repositorio_de_mensagens(provider_message_id)
  where provider_message_id is not null;

-- Índices de performance
create index if not exists repositorio_de_mensagens_created_at_idx
  on public.repositorio_de_mensagens(created_at desc);

create index if not exists repositorio_de_mensagens_cliente_idx
  on public.repositorio_de_mensagens(whatsapp_cliente);

create index if not exists repositorio_de_mensagens_sender_idx
  on public.repositorio_de_mensagens(sender_type);

create index if not exists repositorio_de_mensagens_conv_idx
  on public.repositorio_de_mensagens(conversation_id);

create index if not exists repositorio_de_mensagens_tsv_idx
  on public.repositorio_de_mensagens using gin(tsv);

-- Índice para embeddings (HNSW quando disponível)
do $$ begin
  execute 'create index if not exists repositorio_de_mensagens_emb_hnsw on public.repositorio_de_mensagens using hnsw (embedding vector_cosine_ops)';
exception when others then
  begin
    execute 'create index if not exists repositorio_de_mensagens_emb_ivfflat on public.repositorio_de_mensagens using ivfflat (embedding vector_cosine_ops)';
  exception when others then null; end;
end $$;

-- RLS (permitir authenticated e service_role)
alter table public.repositorio_de_mensagens enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='repositorio_de_mensagens' and policyname='rm_select_authenticated'
  ) then
    create policy rm_select_authenticated on public.repositorio_de_mensagens for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='repositorio_de_mensagens' and policyname='rm_modify_authenticated'
  ) then
    create policy rm_modify_authenticated on public.repositorio_de_mensagens for all to authenticated using (true) with check (true);
  end if;
  -- service_role não passa por RLS, mas manter política para simetria não é necessário
end $$;

-- Views auxiliares
create or replace view public.vw_rm_conversas as
select
  conversation_id,
  min(created_at) as first_message_at,
  max(created_at) as last_message_at,
  count(*) as total_msgs,
  count(*) filter (where sender_type = 'cliente') as total_cliente,
  count(*) filter (where sender_type = 'ia') as total_ia,
  count(*) filter (where sender_type = 'humano') as total_humano,
  min(whatsapp_cliente) as whatsapp_cliente,
  min(whatsapp_empresa) as whatsapp_empresa
from public.repositorio_de_mensagens
group by conversation_id;

create or replace view public.vw_rm_insights_diarios as
select
  date_trunc('day', created_at) as dia,
  sender_type,
  count(*) as total
from public.repositorio_de_mensagens
group by 1,2
order by 1 desc;

-- Helper function para busca full-text com websearch
create or replace function public.rm_buscar(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_sender sender_type default null,
  p_numero text default null,
  p_query text default null,
  p_limit int default 100,
  p_offset int default 0
)
returns setof public.repositorio_de_mensagens
language sql
stable
as $$
  select *
  from public.repositorio_de_mensagens m
  where m.created_at between coalesce(p_inicio, '-infinity') and coalesce(p_fim, 'infinity')
    and (p_sender is null or m.sender_type = p_sender)
    and (p_numero is null or m.whatsapp_cliente = p_numero or m.whatsapp_empresa = p_numero)
    and (
      p_query is null
      or m.tsv @@ websearch_to_tsquery('portuguese', p_query)
    )
  order by m.created_at desc
  limit greatest(0, p_limit)
  offset greatest(0, p_offset)
$$;

-- Marcar versão em app_migrations
create table if not exists public.app_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

insert into public.app_migrations (version, applied_at)
values ('9', now())
on conflict (version) do nothing;


