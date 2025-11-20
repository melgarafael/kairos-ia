-- v42 – Q&A: permitir INSERT/UPDATE/DELETE via anon (escopo por organização)

set search_path = public, auth;

alter table public.qna_pairs enable row level security;

do $$
begin
  if exists (
    select 1 from pg_policies 
    where schemaname='public' and tablename='qna_pairs' and policyname='qna_pairs_modify_own_org'
  ) then
    drop policy qna_pairs_modify_own_org on public.qna_pairs;
  end if;
end $$;

create policy qna_pairs_modify_own_org on public.qna_pairs
  for all
  to anon, authenticated
  using (
    organization_id is not null
    and organization_id::text = nullif(current_setting('app.organization_id', true), '')
  )
  with check (
    organization_id is not null
    and organization_id::text = nullif(current_setting('app.organization_id', true), '')
  );

insert into public.app_migrations (version, applied_at)
values ('42', now())
on conflict (version) do nothing;


