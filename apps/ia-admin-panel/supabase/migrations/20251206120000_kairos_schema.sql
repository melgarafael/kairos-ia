-- Kairos IA schema bootstrap
-- Creates user-scoped tables for Human Design data, daily logs, and AI memories with RLS.

-- Required for gen_random_uuid()
create extension if not exists "pgcrypto";

-- Profiles (app-level preferences)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text,
  preferences jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_owner_all"
  on public.profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "profiles_service_role_all"
  on public.profiles
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');


-- Human Design profile (one per user, stores normalized + raw payload)
create table if not exists public.human_design_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tipo text,
  estrategia text,
  autoridade text,
  perfil text,
  cruz_incarnacao text,
  centros_definidos jsonb,
  centros_abertos jsonb,
  canais jsonb,
  portas jsonb,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.human_design_profiles enable row level security;

create policy "hd_profiles_owner_all"
  on public.human_design_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "hd_profiles_service_role_all"
  on public.human_design_profiles
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');


-- Daily logs / check-ins
create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null default (current_date at time zone 'utc'),
  humor_energia text,
  principais_desafios text,
  foco_do_dia text,
  created_at timestamptz not null default now()
);

create index if not exists idx_daily_logs_user_date on public.daily_logs(user_id, data desc);

alter table public.daily_logs enable row level security;

create policy "daily_logs_owner_all"
  on public.daily_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "daily_logs_service_role_all"
  on public.daily_logs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');


-- AI memories (lightweight retrieval layer)
create table if not exists public.ai_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text, -- e.g., chat, daily_log, insight_manual
  source_id uuid,
  content text not null,
  tags text[],
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_memories_user_created_at on public.ai_memories(user_id, created_at desc);
create index if not exists idx_ai_memories_tags on public.ai_memories using gin(tags);

alter table public.ai_memories enable row level security;

create policy "ai_memories_owner_all"
  on public.ai_memories
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_memories_service_role_all"
  on public.ai_memories
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');


-- AI sessions (optional grouping for chats)
create table if not exists public.ai_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_sessions_user on public.ai_sessions(user_id, created_at desc);

alter table public.ai_sessions enable row level security;

create policy "ai_sessions_owner_all"
  on public.ai_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_sessions_service_role_all"
  on public.ai_sessions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');


-- AI messages (per session)
create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_messages_session on public.ai_messages(session_id, created_at asc);

alter table public.ai_messages enable row level security;

create policy "ai_messages_owner_all"
  on public.ai_messages
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_messages_service_role_all"
  on public.ai_messages
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');


-- Human Design library (seedable reference content)
create table if not exists public.hd_library_entries (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  content text not null,
  tags text[],
  created_at timestamptz not null default now()
);

alter table public.hd_library_entries enable row level security;

-- Read-only for authenticated users; service role full control
create policy "hd_library_auth_read"
  on public.hd_library_entries
  for select
  to authenticated
  using (true);

create policy "hd_library_service_role_all"
  on public.hd_library_entries
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');


comment on table public.human_design_profiles is 'Kairos IA: normalized Human Design data and raw payload';
comment on table public.daily_logs is 'Kairos IA: user daily check-ins for alignment';
comment on table public.ai_memories is 'Kairos IA: synthesized memories for IA context';
comment on table public.ai_sessions is 'Kairos IA: chat sessions grouping messages';
comment on table public.hd_library_entries is 'Kairos IA: reference content for future RAG/HAG';

