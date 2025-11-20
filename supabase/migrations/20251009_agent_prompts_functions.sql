-- v46 – Agent Prompts: RPCs para upsert com contexto RLS na mesma sessão

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

insert into public.app_migrations (version, applied_at)
values ('45', now())
on conflict (version) do nothing;


