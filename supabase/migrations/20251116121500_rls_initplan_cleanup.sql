-- Cleanup residual RLS policies still calling auth.uid()/current_setting sem SELECT wrapper
set search_path = public, auth;

begin;

do $plpgsql$
declare
  rec record;
  new_using text;
  new_check text;
  changed boolean;
begin
  for rec in (
    select
      schemaname,
      tablename,
      policyname,
      qual as using_sql,
      with_check as check_sql
    from pg_policies pol
    where schemaname = 'public'
      and (
        (qual is not null and (qual ~* 'auth\s*\.\s*[a-z_]+\s*\(' or qual ~* '"auth"\s*\.\s*"[a-z_]+"\s*\(' or qual ~* 'current_setting'))
        or
        (with_check is not null and (with_check ~* 'auth\s*\.\s*[a-z_]+\s*\(' or with_check ~* '"auth"\s*\.\s*"[a-z_]+"\s*\(' or with_check ~* 'current_setting'))
      )
  ) loop
    new_using := rec.using_sql;
    new_check := rec.check_sql;
    changed := false;

    if new_using is not null then
      new_using := regexp_replace(new_using, '(?<!select\s)"auth"\s*\.\s*"([A-Za-z0-9_]+)"\s*\(\s*\)', '(select auth.\1())', 'gi');
      new_using := regexp_replace(new_using, '(?<!select\s)auth\s*\.\s*([A-Za-z0-9_]+)\s*\(\s*\)', '(select auth.\1())', 'gi');
      new_using := regexp_replace(new_using, '(?<!select\s)current_setting\s*\(([^)]*)\)', '(select current_setting(\1))', 'gi');
      changed := changed or new_using <> rec.using_sql;
    end if;

    if new_check is not null then
      new_check := regexp_replace(new_check, '(?<!select\s)"auth"\s*\.\s*"([A-Za-z0-9_]+)"\s*\(\s*\)', '(select auth.\1())', 'gi');
      new_check := regexp_replace(new_check, '(?<!select\s)auth\s*\.\s*([A-Za-z0-9_]+)\s*\(\s*\)', '(select auth.\1())', 'gi');
      new_check := regexp_replace(new_check, '(?<!select\s)current_setting\s*\(([^)]*)\)', '(select current_setting(\1))', 'gi');
      changed := changed or new_check <> rec.check_sql;
    end if;

    if changed then
      if new_using is not null then
        execute format(
          'alter policy %I on %I.%I using (%s)',
          rec.policyname,
          rec.schemaname,
          rec.tablename,
          new_using
        );
      end if;
      if new_check is not null then
        execute format(
          'alter policy %I on %I.%I with check (%s)',
          rec.policyname,
          rec.schemaname,
          rec.tablename,
          new_check
        );
      end if;
    end if;
  end loop;
end
$plpgsql$;

commit;


