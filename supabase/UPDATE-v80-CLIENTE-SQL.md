-- v80 – Q&A: RPC de update com contexto RLS na mesma sessão

-- Esta migration corrige o erro PGRST116 ao editar Q&A, garantindo que o contexto RLS
-- seja configurado na mesma sessão da operação UPDATE.

set search_path = public, auth;

BEGIN;

-- Q&A: atualizar por id garantindo contexto de organização na MESMA sessão
create or replace function public.qna_update(
  p_organization_id uuid,
  p_id uuid,
  p_pergunta text default null,
  p_resposta text default null,
  p_categoria text default null,
  p_tags text[] default null
)
returns public.qna_pairs
language plpgsql
as $$
declare
  rec public.qna_pairs;
begin
  -- Configurar contexto RLS na mesma sessão
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  
  -- Atualizar apenas campos fornecidos (não null)
  -- Se o parâmetro for null, mantém o valor atual; se for fornecido (mesmo vazio), atualiza
  update public.qna_pairs
  set
    pergunta = case when p_pergunta is not null then trim(p_pergunta) else pergunta end,
    resposta = case when p_resposta is not null then trim(p_resposta) else resposta end,
    categoria = case 
      when p_categoria is not null then coalesce(nullif(trim(p_categoria), ''), 'Geral')
      else categoria 
    end,
    tags = coalesce(p_tags, tags),
    updated_at = now()
  where id = p_id
    and organization_id = p_organization_id
  returning * into rec;
  
  if rec.id is null then
    raise exception 'Q&A não encontrado ou sem permissão';
  end if;
  
  return rec;
end;
$$;

grant execute on function public.qna_update(uuid, uuid, text, text, text, text[]) to anon, authenticated;

COMMIT;

-- Marcar versão
insert into public.app_migrations (version, applied_at)
values ('80', now())
on conflict (version) do nothing;

