-- Migration: Enrich admin chat tables with OpenAI metadata
-- Adds columns required by IA Console V2 (conversation tracking, metadata, response ids)

alter table if exists public.admin_chat_sessions
  add column if not exists openai_conversation_id text,
  add column if not exists last_response_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_admin_chat_sessions_openai_conversation
  on public.admin_chat_sessions (openai_conversation_id);

alter table if exists public.admin_chat_messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;



