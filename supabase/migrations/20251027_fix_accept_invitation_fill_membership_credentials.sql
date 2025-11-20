-- Update RPC to atomically accept invitation and fill membership credentials/name
set search_path = public, auth;

begin;

-- Ensure function exists and runs with elevated privileges
create or replace function public.saas_accept_invitation(
  p_token text,
  p_accepting_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_inv public.saas_invitations%rowtype;
  v_url text;
  v_key text;
  v_org_name text;
begin
  -- Load invitation by token
  select * into v_inv
  from public.saas_invitations
  where token = p_token
    and status = 'pending'
  limit 1;
  if not found then
    return false;
  end if;

  -- Expiration guard
  if v_inv.expires_at < now() then
    update public.saas_invitations
      set status = 'expired'
    where id = v_inv.id;
    return false;
  end if;

  -- Prefer credentials from the inviter (owner/admin); fallback to the org owner mapping
  select su.supabase_url, su.supabase_key_encrypted
    into v_url, v_key
  from public.saas_users su
  where su.id = v_inv.invited_by
  limit 1;

  if v_url is null or v_key is null then
    select su.supabase_url, su.supabase_key_encrypted
      into v_url, v_key
    from public.saas_users su
    join public.saas_organizations so on so.owner_id = su.id
    where so.client_org_id = v_inv.organization_id_in_client
    limit 1;
  end if;

  -- Organization display name (mirror in Master)
  select so.name into v_org_name
  from public.saas_organizations so
  where so.client_org_id = v_inv.organization_id_in_client
  limit 1;

  -- Upsert membership atomically with composite key (saas_user_id + organization_id_in_client)
  insert into public.saas_memberships(
    saas_user_id,
    organization_id_in_client,
    role,
    status,
    invited_by,
    supabase_url,
    supabase_key_encrypted,
    organization_name,
    created_at,
    updated_at
  ) values (
    p_accepting_user_id,
    v_inv.organization_id_in_client,
    v_inv.role,
    'active',
    v_inv.invited_by,
    v_url,
    v_key,
    v_org_name,
    now(),
    now()
  )
  on conflict (saas_user_id, organization_id_in_client)
  do update set
    role = excluded.role,
    status = 'active',
    invited_by = excluded.invited_by,
    supabase_url = coalesce(excluded.supabase_url, public.saas_memberships.supabase_url),
    supabase_key_encrypted = coalesce(excluded.supabase_key_encrypted, public.saas_memberships.supabase_key_encrypted),
    organization_name = coalesce(excluded.organization_name, public.saas_memberships.organization_name),
    updated_at = now();

  -- Mark invitation as accepted
  update public.saas_invitations
    set status = 'accepted', accepted_by = p_accepting_user_id, accepted_at = now()
    where id = v_inv.id;

  return true;
end $$;

-- Allow execution by API roles
grant execute on function public.saas_accept_invitation(text, uuid) to anon, authenticated;

commit;



