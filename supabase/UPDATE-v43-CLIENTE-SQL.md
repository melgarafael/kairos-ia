-- v43 – Q&A: RPCs para inserir/bulk inserir com contexto RLS na mesma sessão

BEGIN;

-- Função para inserir único registro garantindo contexto de organização na MESMA sessão
create or replace function public.qna_insert(
  p_organization_id uuid,
  p_pergunta text,
  p_resposta text,
  p_categoria text default 'Geral',
  p_tags text[] default '{}'
)
returns public.qna_pairs
language plpgsql
as $$
declare
  rec public.qna_pairs;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  insert into public.qna_pairs (organization_id, pergunta, resposta, categoria, tags)
  values (
    p_organization_id,
    trim(coalesce(p_pergunta, '')),
    trim(coalesce(p_resposta, '')),
    coalesce(nullif(trim(coalesce(p_categoria, '')), ''), 'Geral'),
    coalesce(p_tags, '{}'::text[])
  )
  returning * into rec;
  return rec;
end;
$$;

grant execute on function public.qna_insert(uuid, text, text, text, text[]) to anon, authenticated;

-- Função bulk – insere vários itens (espera JSON array de objetos)
create or replace function public.qna_bulk_upsert(
  p_organization_id uuid,
  p_items jsonb
)
returns integer
language plpgsql
as $$
declare
  item jsonb;
  v_count int := 0;
  v_tags text[];
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return 0;
  end if;
  for item in select jsonb_array_elements(p_items) loop
    v_tags := coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(item->'tags_list')),
      '{}'::text[]
    );
    insert into public.qna_pairs (organization_id, pergunta, resposta, categoria, tags)
    values (
      p_organization_id,
      trim(coalesce(item->>'pergunta', '')),
      trim(coalesce(item->>'resposta', '')),
      coalesce(nullif(trim(coalesce(item->>'categoria', '')), ''), 'Geral'),
      v_tags
    )
    on conflict do nothing;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.qna_bulk_upsert(uuid, jsonb) to anon, authenticated;

COMMIT;

-- Marcar versão
insert into public.app_migrations (version, applied_at)
values ('43', now())
on conflict (version) do nothing;


