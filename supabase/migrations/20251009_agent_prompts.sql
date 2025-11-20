-- Agent Prompts – store per-organization agent prompts and related instructions
-- Use case: N8n or the app can fetch the latest prompt by organization + agent_name

-- 1) Table
create table if not exists public.agent_prompts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  agent_name text not null,
  prompt text not null,
  tools_instructions text null,
  tasks text null,
  business_description text null,
  agent_goal text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, agent_name)
);

create index if not exists agent_prompts_org_idx on public.agent_prompts (organization_id);

-- 2) RLS
alter table public.agent_prompts enable row level security;

-- 3) updated_at trigger (idempotent shared helper)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp_on_agent_prompts on public.agent_prompts;
create trigger set_timestamp_on_agent_prompts
before update on public.agent_prompts
for each row execute function public.set_updated_at();

-- 4) Policies (idempotent) –
-- Select is allowed for anon and authenticated when org context is provided via header or app setting.
-- Modifications restricted to authenticated with the same org context.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agent_prompts' and policyname = 'agent_prompts_select_ctx'
  ) then
    create policy agent_prompts_select_ctx on public.agent_prompts
      for select
      to anon, authenticated
      using (
        organization_id is not null
        and organization_id::text = coalesce(
          nullif(current_setting('request.header.x-organization-id', true), ''),
          nullif(current_setting('app.organization_id', true), '')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agent_prompts' and policyname = 'agent_prompts_modify_ctx'
  ) then
    create policy agent_prompts_modify_ctx on public.agent_prompts
      for all
      to authenticated
      using (
        organization_id is not null
        and organization_id::text = coalesce(
          nullif(current_setting('request.header.x-organization-id', true), ''),
          nullif(current_setting('app.organization_id', true), '')
        )
      )
      with check (
        organization_id is not null
        and organization_id::text = coalesce(
          nullif(current_setting('request.header.x-organization-id', true), ''),
          nullif(current_setting('app.organization_id', true), '')
        )
      );
  end if;
end $$;


