BEGIN;

-- v53 – RPC para listar chats do repositório (agrupados), respeitando organização
create or replace function public.rm_list_chats(
  p_organization_id uuid,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  conversation_id text,
  whatsapp_empresa text,
  whatsapp_cliente text,
  last_message_at timestamptz,
  messages_count bigint
)
language sql
stable
as $$
  select
    m.conversation_id,
    m.whatsapp_empresa,
    m.whatsapp_cliente,
    max(m.created_at) as last_message_at,
    count(*) as messages_count
  from public.repositorio_de_mensagens m
  where m.organization_id = p_organization_id
  group by m.conversation_id, m.whatsapp_empresa, m.whatsapp_cliente
  order by last_message_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0)
$$;

do $$ begin
  grant execute on function public.rm_list_chats(uuid, int, int) to anon, authenticated;
exception when others then null; end $$;

COMMIT;

insert into public.app_migrations (version, applied_at)
values ('53', now())
on conflict (version) do nothing;

