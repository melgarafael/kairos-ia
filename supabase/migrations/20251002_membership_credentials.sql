-- Add credentials columns to saas_memberships for non-owner access
set search_path = public, auth;

begin;

do $$ begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'saas_memberships' and column_name = 'supabase_url'
  ) then
    alter table public.saas_memberships add column supabase_url text;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'saas_memberships' and column_name = 'supabase_key_encrypted'
  ) then
    alter table public.saas_memberships add column supabase_key_encrypted text;
  end if;
end $$;

create index if not exists idx_saas_memberships_org_user on public.saas_memberships(organization_id_in_client, saas_user_id);

commit;


