-- Enable RLS and add organization-scoped policies for crm_lead_interests
-- Safe, idempotent migration

begin;

-- Ensure helper exists
create or replace function public.set_rls_context(p_organization_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
end; $$;

-- Enable RLS on crm_lead_interests
do $$
begin
  perform 1 from information_schema.tables 
   where table_schema = 'public' and table_name = 'crm_lead_interests';
  if found then
    execute 'alter table public.crm_lead_interests enable row level security';
  end if;
end $$;

-- Policies (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'crm_lead_interests' and policyname = 'interests_select_org'
  ) then
    create policy "interests_select_org"
      on public.crm_lead_interests
      for select
      to authenticated, anon
      using ((organization_id::text = nullif(current_setting('app.organization_id', true), '')));
  end if;

  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'crm_lead_interests' and policyname = 'interests_modify_org'
  ) then
    create policy "interests_modify_org"
      on public.crm_lead_interests
      for all
      to authenticated, anon
      using ((organization_id::text = nullif(current_setting('app.organization_id', true), '')))
      with check ((organization_id::text = nullif(current_setting('app.organization_id', true), '')));
  end if;
end $$;

commit;


