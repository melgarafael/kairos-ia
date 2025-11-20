-- Allow anon read on WhatsApp tables so UI can list content (dev). For prod, restrict.

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='whatsapp_contacts' and policyname='whatsapp_contacts_select_anon') then
    create policy whatsapp_contacts_select_anon on public.whatsapp_contacts for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='whatsapp_conversations' and policyname='whatsapp_conversations_select_anon') then
    create policy whatsapp_conversations_select_anon on public.whatsapp_conversations for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='whatsapp_messages' and policyname='whatsapp_messages_select_anon') then
    create policy whatsapp_messages_select_anon on public.whatsapp_messages for select to anon using (true);
  end if;
end $$;


