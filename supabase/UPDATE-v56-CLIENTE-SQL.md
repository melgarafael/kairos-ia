BEGIN;

-- v56 – RPC rm_get_conversation_messages: obter mensagens por conversation_id (mesma sessão)
create or replace function public.rm_get_conversation_messages(
  p_organization_id uuid,
  p_conversation_id text,
  p_limit int default 200,
  p_offset int default 0
)
returns table (
  id uuid,
  conversation_id text,
  content_text text,
  sender_type public.sender_type,
  whatsapp_cliente text,
  whatsapp_empresa text,
  created_at timestamptz
)
language plpgsql
stable
as $$
begin
  -- Garantir contexto de organização na MESMA sessão
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);

  return query
  select m.id,
         m.conversation_id,
         m.content_text,
         m.sender_type,
         m.whatsapp_cliente,
         m.whatsapp_empresa,
         m.created_at
  from public.repositorio_de_mensagens m
  where m.organization_id = p_organization_id
    and m.conversation_id = p_conversation_id
  order by m.created_at asc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;

do $$ begin
  grant execute on function public.rm_get_conversation_messages(uuid, text, int, int) to anon, authenticated;
exception when others then null; end $$;

COMMIT;

insert into public.app_migrations (version, applied_at)
values ('56', now())
on conflict (version) do nothing;


