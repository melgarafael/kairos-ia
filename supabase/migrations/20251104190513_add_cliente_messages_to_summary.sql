-- Add cliente_messages field to ai_agent_metrics_summary function
-- This allows calculating average messages per user using only cliente messages

-- Drop existing function first since we're changing the return type
drop function if exists public.ai_agent_metrics_summary(uuid, timestamptz, timestamptz);

-- Create the function with the new return type
create function public.ai_agent_metrics_summary(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  total_messages bigint,
  human_messages bigint,
  cliente_messages bigint,
  users_attended bigint
)
language sql
stable
as $$
  select
    count(*) as total_messages,
    count(*) filter (where sender_type in ('cliente','humano')) as human_messages,
    count(*) filter (where sender_type = 'cliente') as cliente_messages,
    count(distinct whatsapp_cliente) as users_attended
  from public.repositorio_de_mensagens
  where organization_id = p_org
    and created_at >= p_from
    and created_at <= p_to;
$$;

comment on function public.ai_agent_metrics_summary is 'Window summary: total messages, human messages, cliente messages, and distinct whatsapp_cliente count for the organization.';

