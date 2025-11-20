-- Master DB: Mom Test survey table
set search_path = public, auth;

-- Create table if not exists
create table if not exists public.pesquisa (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete set null,
  nome text null,
  email text null,
  phone text null,
  answers jsonb not null default '{}'::jsonb,
  score int not null default 0
);

-- Helpful indexes
create index if not exists idx_pesquisa_created_at on public.pesquisa(created_at desc);
create index if not exists idx_pesquisa_email on public.pesquisa(email);
create index if not exists idx_pesquisa_user on public.pesquisa(user_id);

-- RLS
alter table public.pesquisa enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'pesquisa' and policyname = 'Allow insert for anon and authenticated'
  ) then
    create policy "Allow insert for anon and authenticated" on public.pesquisa
      for insert to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'pesquisa' and policyname = 'Users can view own entries'
  ) then
    create policy "Users can view own entries" on public.pesquisa
      for select to authenticated
      using (auth.uid() is not null and (user_id is null or user_id = auth.uid()));
  end if;
end $$;

comment on table public.pesquisa is 'Mom Test survey submissions with computed score (0–10)';
comment on column public.pesquisa.answers is 'Raw answers object captured from form (keys are question ids)';


