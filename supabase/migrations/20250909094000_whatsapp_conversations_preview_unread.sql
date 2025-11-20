-- Add last_message_preview and unread_count to whatsapp_conversations

alter table if exists public.whatsapp_conversations
  add column if not exists last_message_preview text,
  add column if not exists unread_count integer not null default 0;


