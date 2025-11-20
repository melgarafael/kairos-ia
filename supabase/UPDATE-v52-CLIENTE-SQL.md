BEGIN;

-- v52 – Agent Prompts: atualizar RPCs para incluir novos campos JSONB e contexto de organização

-- Listagem com contexto (mesma sessão)
create or replace function public.agent_prompts_list(
  p_organization_id uuid,
  p_query text default null,
  p_limit int default 500,
  p_offset int default 0
)
returns setof public.agent_prompts
language plpgsql
as $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  return query
    select id,
           organization_id,
           agent_name,
           prompt,
           tools_instructions,
           tasks,
           business_description,
           agent_goal,
           output_format,
           rhf_feedbacks,
           fewshots_examples,
           created_at,
           updated_at
    from public.agent_prompts
    where organization_id = p_organization_id
      and (
        p_query is null
        or p_query = ''
        or (
          coalesce(agent_name,'') ilike '%' || p_query || '%'
          or coalesce(prompt,'') ilike '%' || p_query || '%'
          or coalesce(business_description,'') ilike '%' || p_query || '%'
          or coalesce(agent_goal,'') ilike '%' || p_query || '%'
        )
      )
    order by updated_at desc
    limit greatest(p_limit, 1)
    offset greatest(p_offset, 0);
end;
$$;
grant execute on function public.agent_prompts_list(uuid, text, int, int) to anon, authenticated;

-- Upsert incluindo os novos campos
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
  p_fewshots_examples jsonb default '[]'::jsonb
)
returns public.agent_prompts
language plpgsql
as $$
declare
  rec public.agent_prompts;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  insert into public.agent_prompts (
    organization_id,
    agent_name,
    prompt,
    tools_instructions,
    tasks,
    business_description,
    agent_goal,
    output_format,
    rhf_feedbacks,
    fewshots_examples
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
    p_fewshots_examples
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
    updated_at = now()
  returning * into rec;
  return rec;
end;
$$;
grant execute on function public.agent_prompts_upsert(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb
) to anon, authenticated;

COMMIT;

insert into public.app_migrations (version, applied_at)
values ('52', now())
on conflict (version) do nothing;

