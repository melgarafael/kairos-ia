-- Dev-only: allow anon inserts/updates/deletes for WhatsApp tables so Edge Function (using anon key) can write
-- For production, prefer using client's service role in the Edge or tightening policies to specific JWT claims.

alter table public.whatsapp_contacts enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='whatsapp_contacts' and policyname='whatsapp_contacts_modify_anon') then
    create policy whatsapp_contacts_modify_anon on public.whatsapp_contacts for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='whatsapp_conversations' and policyname='whatsapp_conversations_modify_anon') then
    create policy whatsapp_conversations_modify_anon on public.whatsapp_conversations for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='whatsapp_messages' and policyname='whatsapp_messages_modify_anon') then
    create policy whatsapp_messages_modify_anon on public.whatsapp_messages for all to anon using (true) with check (true);
  end if;
end $$;


