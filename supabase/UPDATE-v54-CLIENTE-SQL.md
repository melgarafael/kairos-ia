BEGIN;

-- v54 – Fix agent_prompts_list: return columns in table order (avoid 42804)

drop function if exists public.agent_prompts_list(uuid, text, int, int);

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
    select *
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

do $$ begin
  grant execute on function public.agent_prompts_list(uuid, text, int, int) to anon, authenticated;
exception when others then null; end $$;

COMMIT;

insert into public.app_migrations (version, applied_at)
values ('54', now())
on conflict (version) do nothing;

