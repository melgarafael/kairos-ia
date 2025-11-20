-- Create RPC to set organization context for RLS policies
set search_path = public, auth;

-- Drop and recreate for idempotency
drop function if exists public.set_rls_context(uuid);

create or replace function public.set_rls_context(p_organization_id uuid)
returns void
language sql
as $$
  select set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
$$;

-- Ensure authenticated/anon roles can execute (PostgREST)
do $$ begin
  grant execute on function public.set_rls_context(uuid) to anon, authenticated;
exception when others then
  -- ignore if roles not present in this environment
  null;
end $$;

comment on function public.set_rls_context(uuid) is 'Sets app.organization_id GUC for row-level policies.';


