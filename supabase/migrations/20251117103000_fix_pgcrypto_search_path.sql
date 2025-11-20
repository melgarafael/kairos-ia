-- Ensure pgcrypto functions keep working after search_path hardening
set search_path = public, auth, pg_catalog;

begin;

-- Guarantee extensions schema exists and is accessible
create schema if not exists extensions;
grant usage on schema extensions to public, anon, authenticated, service_role;

do $$
declare
  ext_schema text;
begin
  if exists (select 1 from pg_extension where extname = 'pgcrypto') then
    select n.nspname
      into ext_schema
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto';

    if ext_schema is distinct from 'extensions' then
      execute 'alter extension pgcrypto set schema extensions';
    end if;
  else
    execute 'create extension pgcrypto with schema extensions';
  end if;
end;
$$;

-- Restore deterministic search_path (needs extensions for pgcrypto functions)
do $$
declare
  func text;
  desired_search_path constant text := 'public, auth, pg_catalog, extensions';
  funcs constant text[] := array[
    'public.encrypt_key(text)',
    'public.decrypt_key(text)',
    'public.ensure_key_encrypted(text)',
    'public.get_encryption_key()',
    'public.migrate_keys_to_encryption()',
    'public.reencrypt_organization_keys(uuid)'
  ];
begin
  foreach func in array funcs loop
    if to_regprocedure(func) is not null then
      execute format(
        'alter function %s set search_path to %s',
        func,
        desired_search_path
      );
    else
      raise notice 'Function %s not found; skipping search_path update', func;
    end if;
  end loop;
end;
$$;

commit;


