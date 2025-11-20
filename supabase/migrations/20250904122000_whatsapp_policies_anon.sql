-- Dev policy: allow anon role to read/write WhatsApp tables (front uses anon client without user session)
-- NOTE: For production, restrict to authenticated or move writes to Edge Functions.

alter table public.whatsapp_integrations enable row level security;

do $$
begin
  -- Allow anon for select/insert/update/delete (dev only)
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'whatsapp_integrations' and policyname = 'whatsapp_integrations_select_anon'
  ) then
    create policy whatsapp_integrations_select_anon on public.whatsapp_integrations for select to anon using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'whatsapp_integrations' and policyname = 'whatsapp_integrations_modify_anon'
  ) then
    create policy whatsapp_integrations_modify_anon on public.whatsapp_integrations for all to anon using (true) with check (true);
  end if;
end $$;


