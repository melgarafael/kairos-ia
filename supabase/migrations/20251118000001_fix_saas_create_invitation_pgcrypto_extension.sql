-- Fix saas_create_invitation to ensure pgcrypto extension exists and is accessible
-- This migration ensures the function works even if pgcrypto wasn't properly set up
set search_path = public, auth, pg_catalog;

begin;

-- Ensure extensions schema exists
create schema if not exists extensions;
grant usage on schema extensions to public, anon, authenticated, service_role;

-- Ensure pgcrypto extension is enabled and in the extensions schema
do $$
declare
  ext_schema text;
begin
  -- Check if pgcrypto exists
  if exists (select 1 from pg_extension where extname = 'pgcrypto') then
    -- Get current schema
    select n.nspname
      into ext_schema
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto';

    -- Move to extensions schema if not already there
    if ext_schema is distinct from 'extensions' then
      execute 'alter extension pgcrypto set schema extensions';
    end if;
  else
    -- Create extension in extensions schema
    execute 'create extension pgcrypto with schema extensions';
  end if;
end;
$$;

-- Update saas_create_invitation function to ensure it works with pgcrypto
create or replace function public.saas_create_invitation(
  p_email text,
  p_organization_id uuid,
  p_role text,
  p_invited_by uuid,
  p_expires_in_days int default 7
) returns text
language plpgsql
security definer
set search_path = public, auth, pg_catalog, extensions
as $$
declare
  v_token text;
begin
  -- Validate role
  if p_role not in ('owner','admin','member','viewer') then
    raise exception 'invalid role';
  end if;
  
  -- Generate token using pgcrypto from extensions schema
  -- Fallback to public schema if extensions schema doesn't work
  begin
    v_token := encode(extensions.gen_random_bytes(24), 'hex');
  exception when others then
    -- Fallback: try without schema prefix (should work if pgcrypto is in search_path)
    v_token := encode(gen_random_bytes(24), 'hex');
  end;
  
  -- Insert invitation
  insert into public.saas_invitations(
    email, 
    organization_id_in_client, 
    role, 
    token, 
    invited_by, 
    expires_at
  )
  values (
    lower(trim(p_email)), 
    p_organization_id, 
    p_role, 
    v_token, 
    p_invited_by, 
    now() + (p_expires_in_days || ' days')::interval
  );
  
  return v_token;
end $$;

-- Grant execute permission
grant execute on function public.saas_create_invitation(text, uuid, text, uuid, int) to authenticated, service_role;

commit;

