-- RLS performance & policy hygiene fixes
set search_path = public, auth;

begin;

-- 1) Normalize auth.uid()/current_setting calls inside policies
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
        (qual is not null and (qual ~* 'auth\.[a-z_]+\(\)' or qual ~* '"auth"\."[a-z_]+"\(\)' or qual ~* 'current_setting'))
        or
        (with_check is not null and (with_check ~* 'auth\.[a-z_]+\(\)' or with_check ~* '"auth"\."[a-z_]+"\(\)' or with_check ~* 'current_setting'))
      )
  ) loop
    new_using := rec.using_sql;
    new_check := rec.check_sql;
    changed := false;

    if new_using is not null then
      new_using := regexp_replace(new_using, '(?<!select\s)"auth"\."([A-Za-z0-9_]+)"\(\)', '(select auth.\1())', 'gi');
      new_using := regexp_replace(new_using, '(?<!select\s)auth\.([A-Za-z0-9_]+)\(\)', '(select auth.\1())', 'gi');
      new_using := regexp_replace(new_using, '(?<!select\s)current_setting\(([^)]*)\)', '(select current_setting(\1))', 'gi');
      changed := changed or new_using <> rec.using_sql;
    end if;

    if new_check is not null then
      new_check := regexp_replace(new_check, '(?<!select\s)"auth"\."([A-Za-z0-9_]+)"\(\)', '(select auth.\1())', 'gi');
      new_check := regexp_replace(new_check, '(?<!select\s)auth\.([A-Za-z0-9_]+)\(\)', '(select auth.\1())', 'gi');
      new_check := regexp_replace(new_check, '(?<!select\s)current_setting\(([^)]*)\)', '(select current_setting(\1))', 'gi');
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

-- 2) Clean redundant policies / adjust classifications

-- public.saas_supabases_connections: keep only consolidated policy
drop policy if exists "ssc_owner_select" on public.saas_supabases_connections;
drop policy if exists "ssc_owner_insert" on public.saas_supabases_connections;
drop policy if exists "ssc_owner_update" on public.saas_supabases_connections;
drop policy if exists "ssc_owner_delete" on public.saas_supabases_connections;
drop policy if exists "Owner select supabase connections" on public.saas_supabases_connections;

-- public.saas_users: remove permissive trigger policy for users (keep postgres-specific one)
drop policy if exists "Allow trigger insert" on public.saas_users;

drop policy if exists "Allow read for owners and members" on public.saas_organizations;
drop policy if exists "Allow read for org members" on public.saas_organizations;
drop policy if exists "Block all authenticated direct access" on public.saas_organizations;
drop policy if exists "Block authenticated insert" on public.saas_organizations;
drop policy if exists "Block authenticated update" on public.saas_organizations;
drop policy if exists "Block authenticated delete" on public.saas_organizations;

create policy "Block all authenticated direct access"
  on public.saas_organizations
  as restrictive
  for select
  to authenticated
  using (false);

create policy "Block authenticated insert"
  on public.saas_organizations
  as restrictive
  for insert
  to authenticated
  with check (false);

create policy "Block authenticated update"
  on public.saas_organizations
  as restrictive
  for update
  to authenticated
  using (false)
  with check (false);

create policy "Block authenticated delete"
  on public.saas_organizations
  as restrictive
  for delete
  to authenticated
  using (false);

-- public.users: consolidate SELECT policy for all roles
drop policy if exists "Users can view own profile" on public.users;
drop policy if exists "Users can view organization members" on public.users;
drop policy if exists "Users can view same organization members" on public.users;
create policy "Users can view self or organization"
  on public.users
  for select
  to authenticated, authenticator, dashboard_user, anon
  using (
    (select auth.uid()) = id
    or (
      organization_id is not null
      and organization_id = (
        select u2.organization_id
        from public.users u2
        where u2.id = (select auth.uid())
        limit 1
      )
    )
  );

-- 3) Drop duplicate indexes
drop index if exists saas_events_event_time_idx;
drop index if exists idx_saas_orgs_owner_client;

commit;


