-- Supabase lint fixes: enforce SECURITY INVOKER on analytics views and enable RLS on exposed tables
set search_path = public, auth;

begin;

-- 1) Views must run with caller permissions (security_invoker = on)
alter view if exists public.v_daily_active_users_features set (security_invoker = true);
alter view if exists public.v_daily_active_users set (security_invoker = true);
alter view if exists public.crm_funnel set (security_invoker = true);
alter view if exists public.financial_summary set (security_invoker = true);
alter view if exists public.v_feature_usage_daily set (security_invoker = true);
alter view if exists public.dashboard_stats set (security_invoker = true);
alter view if exists public.v_owner_client_orgs set (security_invoker = true);
alter view if exists public.active_user_sessions set (security_invoker = true);

-- 2) Shared helper policies: service-role only tables
do $$
declare
  tbl text;
  policy_name text;
begin
  FOREACH tbl IN ARRAY ARRAY[
    'saas_users_backup',
    'webhooks_log',
    'email_queue',
    'saas_memberships',
    'saas_invitations',
    'saas_org_member_overrides',
    'saas_trail_products',
    'saas_sync_settings',
    'saas_organizations_history',
    'client_migration_state'
  ] LOOP
    if to_regclass('public.' || tbl) is not null then
      policy_name := tbl || '_service_role_only';
      execute format('alter table public.%I enable row level security', tbl);
      execute format('alter table public.%I force row level security', tbl);
      execute format('revoke all on public.%I from anon', tbl);
      execute format('revoke all on public.%I from authenticated', tbl);
      execute format('grant select, insert, update, delete on public.%I to service_role', tbl);
      if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = tbl
          and policyname = policy_name
      ) then
        execute format($policy$
          create policy %I
          on public.%I
          for all
          to service_role
          using (true)
          with check (true)
        $policy$, policy_name, tbl);
      end if;
    end if;
  END LOOP;
end
$$;

-- 3) app_migrations: public read, service role manage
do $$
begin
  if to_regclass('public.app_migrations') is not null then
    execute 'alter table public.app_migrations enable row level security';
    execute 'alter table public.app_migrations force row level security';
    execute 'revoke insert, update, delete on public.app_migrations from anon';
    execute 'revoke insert, update, delete on public.app_migrations from authenticated';
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'app_migrations'
        and policyname = 'app_migrations_read_versions'
    ) then
      execute $policy$
        create policy "app_migrations_read_versions"
        on public.app_migrations
        for select
        to authenticated, anon
        using (true)
      $policy$;
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'app_migrations'
        and policyname = 'app_migrations_service_manage'
    ) then
      execute $policy$
        create policy "app_migrations_service_manage"
        on public.app_migrations
        for all
        to service_role
        using (true)
        with check (true)
      $policy$;
    end if;
  end if;
end
$$;

-- 4) updates_tour: public read, service role manage
do $$
begin
  if to_regclass('public.updates_tour') is not null then
    execute 'alter table public.updates_tour enable row level security';
    execute 'alter table public.updates_tour force row level security';
    execute 'revoke insert, update, delete on public.updates_tour from anon';
    execute 'revoke insert, update, delete on public.updates_tour from authenticated';
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'updates_tour'
        and policyname = 'updates_tour_public_read'
    ) then
      execute $policy$
        create policy "updates_tour_public_read"
        on public.updates_tour
        for select
        to authenticated, anon
        using (true)
      $policy$;
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'updates_tour'
        and policyname = 'updates_tour_service_manage'
    ) then
      execute $policy$
        create policy "updates_tour_service_manage"
        on public.updates_tour
        for all
        to service_role
        using (true)
        with check (true)
      $policy$;
    end if;
  end if;
end
$$;

commit;


