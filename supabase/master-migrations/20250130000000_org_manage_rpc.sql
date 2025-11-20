-- Master: RPC functions for managing organizations (update name, delete)
-- Safe, idempotent migration for MASTER Supabase

set search_path = public, auth;

-- Plan IDs constants (for validation)
-- PRO: d4836a79-186f-4905-bfac-77ec52fa1dde
-- Starter: 8b5a1000-957c-4eaf-beca-954a78187337

-- 1) RPC: Update organization name
--    Allows owner to update organization name and slug in master
create or replace function public.update_organization_name(
  p_user_id uuid,
  p_organization_id uuid,
  p_name text,
  p_slug text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_result jsonb;
begin
  -- Verify ownership
  select owner_id into v_owner_id
  from public.saas_organizations
  where id = p_organization_id;
  
  if v_owner_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'Organization not found'
    );
  end if;
  
  if v_owner_id <> p_user_id then
    return jsonb_build_object(
      'success', false,
      'error', 'Only the owner can update this organization'
    );
  end if;
  
  -- Validate name
  if p_name is null or trim(p_name) = '' then
    return jsonb_build_object(
      'success', false,
      'error', 'Organization name is required'
    );
  end if;
  
  -- If slug provided, check uniqueness (per owner)
  if p_slug is not null and trim(p_slug) <> '' then
    if exists (
      select 1 from public.saas_organizations
      where owner_id = p_user_id
        and slug = trim(p_slug)
        and id <> p_organization_id
    ) then
      return jsonb_build_object(
        'success', false,
        'error', 'This slug is already in use by another organization'
      );
    end if;
  end if;
  
  -- Update organization
  update public.saas_organizations
  set 
    name = trim(p_name),
    slug = coalesce(nullif(trim(p_slug), ''), slug),
    updated_at = now()
  where id = p_organization_id;
  
  -- Return updated organization
  select jsonb_build_object(
    'id', id,
    'name', name,
    'slug', slug,
    'owner_id', owner_id,
    'plan_id', plan_id,
    'updated_at', updated_at
  ) into v_result
  from public.saas_organizations
  where id = p_organization_id;
  
  return jsonb_build_object(
    'success', true,
    'data', v_result
  );
end
$$;

grant execute on function public.update_organization_name(uuid, uuid, text, text) to authenticated, service_role;

-- 2) RPC: Delete organization
--    Deletes organization from master ONLY (preserves client data)
--    Prevents deletion if plan_id is Starter or PRO
create or replace function public.delete_organization(
  p_user_id uuid,
  p_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_plan_id uuid;
  v_pro_plan_id uuid := 'd4836a79-186f-4905-bfac-77ec52fa1dde';
  v_starter_plan_id uuid := '8b5a1000-957c-4eaf-beca-954a78187337';
  v_org_name text;
  v_prev_statement_timeout text := current_setting('statement_timeout');
begin
  -- Verify ownership and get plan_id
  select owner_id, plan_id, name
  into v_owner_id, v_plan_id, v_org_name
  from public.saas_organizations
  where id = p_organization_id;
  
  if v_owner_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'Organization not found'
    );
  end if;
  
  if v_owner_id <> p_user_id then
    return jsonb_build_object(
      'success', false,
      'error', 'Only the owner can delete this organization'
    );
  end if;
  
  -- Check if plan_id is Starter or PRO (prevent deletion)
  if v_plan_id = v_pro_plan_id then
    return jsonb_build_object(
      'success', false,
      'error', 'Cannot delete organization with PRO plan. Please downgrade or contact support.'
    );
  end if;
  
  if v_plan_id = v_starter_plan_id then
    return jsonb_build_object(
      'success', false,
      'error', 'Cannot delete organization with Starter plan. Please downgrade or contact support.'
    );
  end if;
  
  -- Delete organization from master (client data remains intact)
  -- Increase statement timeout temporarily to avoid cancellation during cascades
  begin
    perform set_config('statement_timeout', '120000', true); -- 120s

    delete from public.saas_organizations
    where id = p_organization_id;

  exception
    when others then
      perform set_config('statement_timeout', v_prev_statement_timeout, true);
      raise;
  end;

  perform set_config('statement_timeout', v_prev_statement_timeout, true);
  
  return jsonb_build_object(
    'success', true,
    'message', format('Organization "%s" deleted successfully. Client data preserved. You can resync it later using Sync & Migration.', v_org_name)
  );
end
$$;

grant execute on function public.delete_organization(uuid, uuid) to authenticated, service_role;

