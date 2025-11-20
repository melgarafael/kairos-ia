-- Add instance_id to whatsapp_messages and helpful indexes

alter table if exists public.whatsapp_messages
  add column if not exists instance_id text;

-- Index to filter by instance efficiently
create index if not exists idx_whatsapp_messages_org_instance_time
  on public.whatsapp_messages (organization_id, instance_id, timestamp desc);


