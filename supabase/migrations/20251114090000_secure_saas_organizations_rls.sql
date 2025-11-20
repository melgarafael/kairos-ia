-- Tighten access to saas_organizations and protect Supabase connection repository
set search_path = public, auth;

begin;

drop policy if exists "Allow read saas_organizations" on public.saas_organizations;

-- 2) Ensure active members (non-owners) may still see their organizations while staying scoped
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
      and tablename = 'saas_organizations' 
      and policyname = 'Allow read for org members'
  ) then
    execute $policy$
      create policy "Allow read for org members" on public.saas_organizations
        for select to authenticated
        using (
          exists (
            select 1
            from public.saas_memberships m
            where m.saas_user_id = auth.uid()
              and m.status = 'active'
              and (
                m.organization_id_in_client = public.saas_organizations.client_org_id
                or m.organization_id_in_client = public.saas_organizations.id
              )
          )
        )
    $policy$;
  end if;
end
$$;

-- 3) Lock down saas_supabases_connections so only the owner can list/manage their saved creds
do $$
begin
  if to_regclass('public.saas_supabases_connections') is not null then
    execute 'alter table public.saas_supabases_connections enable row level security';
    execute 'drop policy if exists "Allow read saas_supabases_connections" on public.saas_supabases_connections';
    execute 'drop policy if exists "Allow modify saas_supabases_connections" on public.saas_supabases_connections';
    if not exists (
      select 1 from pg_policies 
      where schemaname = 'public' 
        and tablename = 'saas_supabases_connections' 
        and policyname = 'Owner select supabase connections'
    ) then
      execute $policy$
        create policy "Owner select supabase connections"
        on public.saas_supabases_connections
        for select to authenticated
        using (auth.uid() = owner_id)
      $policy$;
    end if;
    if not exists (
      select 1 from pg_policies 
      where schemaname = 'public' 
        and tablename = 'saas_supabases_connections' 
        and policyname = 'Owner manage supabase connections'
    ) then
      execute $policy$
        create policy "Owner manage supabase connections"
        on public.saas_supabases_connections
        for all to authenticated
        using (auth.uid() = owner_id)
        with check (auth.uid() = owner_id)
      $policy$;
    end if;
  end if;
end
$$;

commit;

