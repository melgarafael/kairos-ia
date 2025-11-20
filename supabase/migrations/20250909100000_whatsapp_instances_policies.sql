-- RLS policies for whatsapp_instances to allow Edge (anon key) to operate

alter table if exists public.whatsapp_instances enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'whatsapp_instances' and policyname = 'whatsapp_instances_select_anon'
  ) then
    create policy whatsapp_instances_select_anon on public.whatsapp_instances for select to anon using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'whatsapp_instances' and policyname = 'whatsapp_instances_modify_anon'
  ) then
    create policy whatsapp_instances_modify_anon on public.whatsapp_instances for all to anon using (true) with check (true);
  end if;
end $$;


