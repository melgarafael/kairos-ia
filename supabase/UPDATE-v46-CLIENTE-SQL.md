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


-- agent_prompts RLS fix: allow writes from anon (UI) with strict org check

BEGIN;

-- Ensure RLS is enabled (idempotent safety)
ALTER TABLE IF EXISTS public.agent_prompts ENABLE ROW LEVEL SECURITY;

-- Recreate modify policy to include anon + authenticated with WITH CHECK
DROP POLICY IF EXISTS agent_prompts_modify_ctx ON public.agent_prompts;
CREATE POLICY agent_prompts_modify_ctx ON public.agent_prompts
  FOR ALL
  TO anon, authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id::text = coalesce(
      NULLIF(current_setting('request.header.x-organization-id', true), ''),
      NULLIF(current_setting('app.organization_id', true), '')
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id::text = coalesce(
      NULLIF(current_setting('request.header.x-organization-id', true), ''),
      NULLIF(current_setting('app.organization_id', true), '')
    )
  );

COMMIT;

-- v45 – Agent Prompts: RPCs para upsert com contexto RLS na mesma sessão

BEGIN;

create or replace function public.agent_prompts_upsert(
  p_organization_id uuid,
  p_agent_name text,
  p_prompt text,
  p_tools_instructions text default null,
  p_tasks text default null,
  p_business_description text default null,
  p_agent_goal text default null
)
returns public.agent_prompts
language plpgsql
as $$
declare
  rec public.agent_prompts;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  insert into public.agent_prompts (
    organization_id, agent_name, prompt, tools_instructions, tasks, business_description, agent_goal
  ) values (
    p_organization_id,
    trim(coalesce(p_agent_name, '')),
    trim(coalesce(p_prompt, '')),
    nullif(trim(coalesce(p_tools_instructions, '')), ''),
    nullif(trim(coalesce(p_tasks, '')), ''),
    nullif(trim(coalesce(p_business_description, '')), ''),
    nullif(trim(coalesce(p_agent_goal, '')), '')
  )
  on conflict (organization_id, agent_name)
  do update set
    prompt = EXCLUDED.prompt,
    tools_instructions = EXCLUDED.tools_instructions,
    tasks = EXCLUDED.tasks,
    business_description = EXCLUDED.business_description,
    agent_goal = EXCLUDED.agent_goal,
    updated_at = now()
  returning * into rec;
  return rec;
end;
$$;

grant execute on function public.agent_prompts_upsert(
  uuid, text, text, text, text, text, text
) to anon, authenticated;

COMMIT;



-- Marcar versão
insert into public.app_migrations (version, applied_at)
values ('46', now())
on conflict (version) do nothing;
