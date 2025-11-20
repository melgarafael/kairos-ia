-- v66 Migration: add advisory lock wrappers and update leads_import_commit

create or replace function public.advisory_key(p text)
returns bigint
language sql immutable as $$
  select (('x' || substr(md5(coalesce(p,'')), 1, 16))::bit(64))::bigint
$$;

create or replace function public.try_advisory_lock(p text)
returns boolean
language sql volatile as $$
  select pg_try_advisory_lock(public.advisory_key(p))
$$;

create or replace function public.advisory_unlock(p text)
returns boolean
language sql volatile as $$
  select pg_advisory_unlock(public.advisory_key(p))
$$;

-- Update commit RPC to use wrappers (see update file for full body)
-- Note: full body kept in UPDATE-v66-CLIENTE-SQL.md; ensure both stay in sync.


