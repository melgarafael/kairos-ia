BEGIN;

-- v55 – Agent Prompts: tonalidade (tone_of_voice) + upsert atualizado

-- 1) Coluna nova em agent_prompts
alter table if exists public.agent_prompts
  add column if not exists tone_of_voice text null;

-- 2) RPC upsert com p_tone_of_voice e grants
drop function if exists public.agent_prompts_upsert(uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb);

create or replace function public.agent_prompts_upsert(
  p_organization_id uuid,
  p_agent_name text,
  p_prompt text,
  p_tools_instructions text default null,
  p_tasks text default null,
  p_business_description text default null,
  p_agent_goal text default null,
  p_output_format jsonb default '{}'::jsonb,
  p_rhf_feedbacks jsonb default '[]'::jsonb,
  p_fewshots_examples jsonb default '[]'::jsonb,
  p_tone_of_voice text default null
)
returns public.agent_prompts
language plpgsql
as $$
declare
  rec public.agent_prompts;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  insert into public.agent_prompts (
    organization_id, agent_name, prompt, tools_instructions, tasks, business_description, agent_goal, output_format, rhf_feedbacks, fewshots_examples, tone_of_voice
  ) values (
    p_organization_id,
    trim(coalesce(p_agent_name, '')),
    trim(coalesce(p_prompt, '')),
    nullif(trim(coalesce(p_tools_instructions, '')), ''),
    nullif(trim(coalesce(p_tasks, '')), ''),
    nullif(trim(coalesce(p_business_description, '')), ''),
    nullif(trim(coalesce(p_agent_goal, '')), ''),
    p_output_format,
    p_rhf_feedbacks,
    p_fewshots_examples,
    nullif(trim(coalesce(p_tone_of_voice, '')), '')
  )
  on conflict (organization_id, agent_name)
  do update set
    prompt = EXCLUDED.prompt,
    tools_instructions = EXCLUDED.tools_instructions,
    tasks = EXCLUDED.tasks,
    business_description = EXCLUDED.business_description,
    agent_goal = EXCLUDED.agent_goal,
    output_format = EXCLUDED.output_format,
    rhf_feedbacks = EXCLUDED.rhf_feedbacks,
    fewshots_examples = EXCLUDED.fewshots_examples,
    tone_of_voice = EXCLUDED.tone_of_voice,
    updated_at = now()
  returning * into rec;
  return rec;
end;
$$;

do $$ begin
  grant execute on function public.agent_prompts_upsert(
    uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, text
  ) to anon, authenticated;
exception when others then null; end $$;

COMMIT;

insert into public.app_migrations (version, applied_at)
values ('55', now())
on conflict (version) do nothing;


