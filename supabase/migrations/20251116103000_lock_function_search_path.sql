-- Harden function search_path and move extensions out of public schema
set search_path = public, auth;

begin;

-- 1) Ensure every public function/procedure has a fixed search_path (public, auth)
do $$
declare
  rec record;
begin
  for rec in (
    select
      p.oid::regprocedure as full_name
    from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and pg_get_userbyid(p.proowner) = current_user
      and p.prokind in ('f', 'p') -- functions or procedures
      and not exists (
        select 1
        from unnest(coalesce(p.proconfig, '{}')) as cfg(setting)
        where setting ilike 'search_path=%'
      )
      and not exists (
        select 1
        from pg_depend d
          join pg_extension e on e.oid = d.refobjid
        where d.objid = p.oid
          and d.deptype = 'e'
      )
  ) loop
    execute format('alter function %s set search_path = public, auth;', rec.full_name);
  end loop;
end
$$;

-- 2) Dedicated schema for extensions (`pg_net`, `pg_trgm`)
create schema if not exists extensions;
grant usage on schema extensions to public, anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_trgm') then
    execute 'alter extension pg_trgm set schema extensions';
  end if;
end
$$;
-- Obs.: pg_net é uma extensão não-relocatable; não tentamos movê-la para evitar erro 0A000.

commit;


