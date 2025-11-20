-- v47 – RPCs de delete para Q&A e Agent Prompts com contexto RLS na mesma sessão

BEGIN;

-- Q&A: deletar por id
create or replace function public.qna_delete(
  p_organization_id uuid,
  p_id uuid
)
returns boolean
language plpgsql
as $$
declare
  v_deleted int := 0;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  delete from public.qna_pairs
  where id = p_id
    and organization_id = p_organization_id;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

grant execute on function public.qna_delete(uuid, uuid) to anon, authenticated;

-- Agent Prompts: deletar por id
create or replace function public.agent_prompts_delete(
  p_organization_id uuid,
  p_id uuid
)
returns boolean
language plpgsql
as $$
declare
  v_deleted int := 0;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  delete from public.agent_prompts
  where id = p_id
    and organization_id = p_organization_id;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

grant execute on function public.agent_prompts_delete(uuid, uuid) to anon, authenticated;

COMMIT;

insert into public.app_migrations (version, applied_at)
values ('47', now())
on conflict (version) do nothing;


