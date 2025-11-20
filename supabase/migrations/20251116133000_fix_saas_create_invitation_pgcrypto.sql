-- Ensure gen_random_bytes is resolved from extensions schema for invitation tokens
set search_path = public, auth;

begin;

create or replace function public.saas_create_invitation(
  p_email text,
  p_organization_id uuid,
  p_role text,
  p_invited_by uuid,
  p_expires_in_days int default 7
) returns text
language plpgsql
set search_path = public, auth
as $$
declare
  v_token text;
begin
  if p_role not in ('owner','admin','member','viewer') then
    raise exception 'invalid role';
  end if;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.saas_invitations(email, organization_id_in_client, role, token, invited_by, expires_at)
  values (lower(trim(p_email)), p_organization_id, p_role, v_token, p_invited_by, now() + (p_expires_in_days || ' days')::interval);
  return v_token;
end $$;

commit;


