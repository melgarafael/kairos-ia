-- Master: utilidades para investigar e corrigir duplicações de organizações
set search_path = public, auth;

-- 1) View auxiliar para detectar múltiplas orgs por owner espelhadas do Client
create or replace view public.v_owner_client_orgs as
select
  owner_id,
  count(*) as orgs_count,
  array_agg(client_org_id) as client_org_ids,
  array_agg(id) as master_org_ids
from public.saas_organizations
group by owner_id;

-- 2) RPC de leitura: lista suspeitos com mais de 1 org
create or replace function public.list_org_duplicate_candidates()
returns table(owner_id uuid, orgs_count int, master_org_ids uuid[])
language sql
security definer
as $$
  select owner_id, orgs_count, master_org_ids
  from public.v_owner_client_orgs
  where orgs_count > 1;
$$;

grant execute on function public.list_org_duplicate_candidates() to authenticated, anon, service_role;

-- 3) RPC segura para reatribuir organization_id do usuário para uma org específica (usa o guard existente)
create or replace function public.reassign_user_organization(p_user_id uuid, p_organization_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  perform set_config('app.allow_org_update', '1', true);
  update public.saas_users
    set organization_id = p_organization_id,
        updated_at = now()
  where id = p_user_id;
end;
$$;

grant execute on function public.reassign_user_organization(uuid, uuid) to service_role;


