-- v45 – Q&A: RPC qna_list (lista itens com contexto de organização na mesma sessão)

BEGIN;

set search_path = public, auth;

-- Função para listar Q&A garantindo contexto de organização
create or replace function public.qna_list(
  p_organization_id uuid,
  p_query text default null,
  p_limit int default 200,
  p_offset int default 0
)
returns setof public.qna_pairs
language plpgsql
as $$
begin
  -- Garantir contexto da organização na sessão atual (RLS)
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);

  return query
    select *
    from public.qna_pairs
    where organization_id = p_organization_id
      and (
        p_query is null
        or trim(p_query) = ''
        or (
          to_tsvector('portuguese', coalesce(pergunta,'') || ' ' || coalesce(resposta,'') || ' ' || coalesce(categoria,''))
          @@ plainto_tsquery('portuguese', p_query)
        )
      )
    order by updated_at desc
    limit greatest(0, coalesce(p_limit, 200))
    offset greatest(0, coalesce(p_offset, 0));
end;
$$;

grant execute on function public.qna_list(uuid, text, int, int) to anon, authenticated;

COMMIT;

-- Marcar versão
insert into public.app_migrations (version, applied_at)
values ('45', now())
on conflict (version) do nothing;


