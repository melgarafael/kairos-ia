-- Add optional Instagram username to crm_leads
alter table if exists public.crm_leads
  add column if not exists instagram_username text;

comment on column public.crm_leads.instagram_username is 'Instagram @username of the lead';



-- 5) Marcar versão
insert into public.app_migrations (version, applied_at)
values ('13', now())
on conflict (version) do nothing;
