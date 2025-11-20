-- v10 – Repositório de mensagens: adicionar organization_id, RLS por organização e ajustar RPC

-- Adicionar coluna organization_id
alter table if exists public.repositorio_de_mensagens
  add column if not exists organization_id uuid;

-- Trigger para preencher organization_id a partir do contexto se nulo
create or replace function public.rm_set_org_from_context()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    begin
      new.organization_id := nullif(current_setting('app.organization_id', true), '')::uuid;
    exception when others then
      -- ignora
      new.organization_id := new.organization_id;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rm_set_org_from_context on public.repositorio_de_mensagens;
create trigger trg_rm_set_org_from_context
before insert on public.repositorio_de_mensagens
for each row execute function public.rm_set_org_from_context();

-- Índice por organização + created_at
create index if not exists repositorio_de_mensagens_org_created_idx
  on public.repositorio_de_mensagens(organization_id, created_at desc);

-- Atualizar RLS: restringir por organização
alter table public.repositorio_de_mensagens enable row level security;

-- Remover políticas antigas permissivas, se existirem
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='repositorio_de_mensagens' and policyname='rm_select_authenticated') then
    drop policy rm_select_authenticated on public.repositorio_de_mensagens;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='repositorio_de_mensagens' and policyname='rm_modify_authenticated') then
    drop policy rm_modify_authenticated on public.repositorio_de_mensagens;
  end if;
end $$;

-- Criar políticas por organização (authenticated)
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='repositorio_de_mensagens' and policyname='rm_select_by_org'
  ) then
    create policy rm_select_by_org on public.repositorio_de_mensagens
      for select to authenticated
      using (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='repositorio_de_mensagens' and policyname='rm_insert_by_org'
  ) then
    create policy rm_insert_by_org on public.repositorio_de_mensagens
      for insert to authenticated
      with check (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='repositorio_de_mensagens' and policyname='rm_update_by_org'
  ) then
    create policy rm_update_by_org on public.repositorio_de_mensagens
      for update to authenticated
      using (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      ) with check (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      );
  end if;
end $$;

-- Ajustar RPC rm_buscar para filtrar por organização
drop function if exists public.rm_buscar(timestamptz, timestamptz, sender_type, text, text, int, int);

create or replace function public.rm_buscar(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_sender sender_type default null,
  p_numero text default null,
  p_query text default null,
  p_limit int default 100,
  p_offset int default 0,
  p_org uuid default null
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
    and (
      m.organization_id is not null
      and m.organization_id = coalesce(p_org, nullif(current_setting('app.organization_id', true), '')::uuid)
    )
  order by m.created_at desc
  limit greatest(0, p_limit)
  offset greatest(0, p_offset)
$$;

-- Marcar versão
insert into public.app_migrations (version, applied_at)
values ('10', now())
on conflict (version) do nothing;


