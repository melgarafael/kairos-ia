-- =====================================================
-- 🛡️ BLOQUEAR EXPOSIÇÃO DE CHAVES SENSÍVEIS
-- =====================================================
-- Esta migração impede que chaves do Supabase sejam expostas
-- diretamente no navegador através de queries RLS.
-- =====================================================

set search_path = public, auth;

begin;

-- 1. Criar função SECURITY DEFINER primeiro (necessária para a view)
-- Esta função executa com permissões de superuser, então pode ler a tabela
create or replace function public.get_organizations_safe_func(p_user_id uuid)
returns table (
  id uuid,
  name text,
  slug text,
  owner_id uuid,
  client_org_id uuid,
  client_supabase_url text,
  plan_id uuid,
  setup_completed boolean,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  has_anon_key boolean,
  has_service_key boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select 
    o.id,
    o.name,
    o.slug,
    o.owner_id,
    o.client_org_id,
    o.client_supabase_url,
    o.plan_id,
    o.setup_completed,
    o.active,
    o.created_at,
    o.updated_at,
    case when o.client_anon_key_encrypted is not null then true else false end as has_anon_key,
    case when o.client_service_key_encrypted is not null then true else false end as has_service_key
  from public.saas_organizations o
  where (
    o.owner_id = p_user_id
    or exists (
      select 1
      from public.saas_memberships m
      where m.saas_user_id = p_user_id
        and m.status = 'active'
        and (
          m.organization_id_in_client = o.client_org_id
          or m.organization_id_in_client = o.id
        )
    )
  )
  order by o.created_at desc;
end;
$$;

-- 2. Criar função RPC que retorna organizações seguras usando SECURITY DEFINER
-- Esta função executa com permissões de superuser, então pode ler a tabela
-- mas sempre retorna apenas campos seguros (nunca expõe chaves)
create or replace function public.saas_organizations_safe()
returns table (
  id uuid,
  name text,
  slug text,
  owner_id uuid,
  client_org_id uuid,
  client_supabase_url text,
  plan_id uuid,
  setup_completed boolean,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  has_anon_key boolean,
  has_service_key boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select * from public.get_organizations_safe_func(auth.uid());
end;
$$;

-- Permitir acesso à função RPC
grant execute on function public.saas_organizations_safe() to authenticated, anon;

-- 2. Remover políticas RLS que permitem SELECT direto na tabela
-- (isso força o uso da Edge Function ou view segura)
drop policy if exists "Users can view own organization" on public.saas_organizations;
drop policy if exists "Allow read for org members" on public.saas_organizations;
drop policy if exists "Organizations are viewable by everyone" on public.saas_organizations;

-- 3. BLOQUEAR completamente acesso direto à tabela para authenticated
-- Forçar uso da view segura ou Edge Function
drop policy if exists "Allow read for owners and members" on public.saas_organizations;
drop policy if exists "Block direct table access" on public.saas_organizations;
drop policy if exists "Block authenticated direct access" on public.saas_organizations;
drop policy if exists "Allow read for owners and members via safe access" on public.saas_organizations;

-- BLOQUEAR completamente SELECT direto na tabela para authenticated
-- Apenas service_role pode acessar diretamente
create policy "Block all authenticated direct access" on public.saas_organizations
  for select to authenticated
  using (false); -- Bloqueia TUDO para authenticated

-- Bloquear também INSERT/UPDATE/DELETE direto
create policy "Block authenticated insert" on public.saas_organizations
  for insert to authenticated
  with check (false);

create policy "Block authenticated update" on public.saas_organizations
  for update to authenticated
  using (false)
  with check (false);

create policy "Block authenticated delete" on public.saas_organizations
  for delete to authenticated
  using (false);

-- A função RPC usa SECURITY DEFINER, então executa com permissões de superuser
-- Isso permite ler a tabela mesmo com RLS bloqueando acesso direto para authenticated

-- Garantir que service_role ainda pode acessar a tabela diretamente
-- (necessário para Edge Functions)
-- Service role não precisa de política RLS (bypass automático)

-- 4. Criar função wrapper para Edge Functions (usa a função interna)
create or replace function public.get_organizations_safe(p_user_id uuid)
returns table (
  id uuid,
  name text,
  slug text,
  owner_id uuid,
  client_org_id uuid,
  client_supabase_url text,
  plan_id uuid,
  setup_completed boolean,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  has_anon_key boolean,
  has_service_key boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select * from public.get_organizations_safe_func(p_user_id);
end;
$$;

-- 5. Garantir que apenas service role pode ler as chaves diretamente
-- Criar função para uso interno (apenas service role)
create or replace function public.get_organization_credentials(
  p_org_id uuid,
  p_user_id uuid
)
returns table (
  client_supabase_url text,
  client_anon_key_encrypted text,
  client_service_key_encrypted text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verificar se o usuário é owner da organização
  if not exists (
    select 1
    from public.saas_organizations
    where id = p_org_id
      and owner_id = p_user_id
  ) then
    raise exception 'Unauthorized: User is not owner of this organization';
  end if;

  -- Retornar credenciais (apenas para uso interno via Edge Function)
  return query
  select 
    o.client_supabase_url,
    o.client_anon_key_encrypted,
    o.client_service_key_encrypted
  from public.saas_organizations o
  where o.id = p_org_id;
end;
$$;

-- 6. Comentários de documentação
comment on function public.saas_organizations_safe() is 
  'Função RPC segura que nunca expõe chaves sensíveis. Use esta função ou a Edge Function saas-orgs para listar organizações.';

comment on function public.get_organizations_safe_func is 
  'Função interna que retorna organizações sem expor chaves. Usada por saas_organizations_safe() e Edge Functions.';

comment on function public.get_organizations_safe is 
  'Wrapper para Edge Functions. Retorna organizações do usuário sem expor chaves.';

comment on function public.get_organization_credentials is 
  'Função interna para obter credenciais. Apenas para uso via Edge Function com service role.';

comment on column public.saas_organizations.client_anon_key_encrypted is 
  '⚠️ SENSÍVEL: Nunca expor diretamente ao frontend. Use Edge Function.';

comment on column public.saas_organizations.client_service_key_encrypted is 
  '⚠️ CRÍTICO: Nunca expor diretamente ao frontend. Use Edge Function com service role.';

commit;

