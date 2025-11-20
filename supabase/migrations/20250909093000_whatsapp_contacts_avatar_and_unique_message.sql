-- Add avatar_url for WhatsApp contacts and enforce unique provider message ids

-- Add avatar_url column if missing
alter table if exists public.whatsapp_contacts
  add column if not exists avatar_url text;

-- Unique provider message id per organization (ignore nulls)
create unique index if not exists uniq_whatsapp_msg_provider_id
  on public.whatsapp_messages (organization_id, provider_message_id)
  where provider_message_id is not null;

-- Helpful index for conversations ordering
create index if not exists idx_whatsapp_conversations_last_msg
  on public.whatsapp_conversations (organization_id, last_message_at desc);


