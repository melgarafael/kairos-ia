-- Migration: Admin Chat History
-- Date: 2025-11-20
-- Description: Creates tables for persistent admin chat history with role-based access control.

-- 1. Table: admin_chat_sessions
create table if not exists public.admin_chat_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    user_email text, -- Snapshot for UI display
    user_role text not null, -- Snapshot: 'founder', 'admin', 'staff'
    title text default 'Nova conversa',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2. Table: admin_chat_messages
create table if not exists public.admin_chat_messages (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.admin_chat_sessions(id) on delete cascade,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    created_at timestamptz not null default now()
);

-- 3. Indexes
create index if not exists idx_admin_chat_sessions_user_id on public.admin_chat_sessions(user_id);
create index if not exists idx_admin_chat_sessions_created_at on public.admin_chat_sessions(created_at desc);
create index if not exists idx_admin_chat_messages_session_id_created on public.admin_chat_messages(session_id, created_at asc);

-- 4. RLS: Enable
alter table public.admin_chat_sessions enable row level security;
alter table public.admin_chat_messages enable row level security;

-- 5. RLS Policies: admin_chat_sessions

-- Staff: Can see own sessions
create policy "Staff can see own sessions"
    on public.admin_chat_sessions
    for select
    to authenticated
    using (
        user_id = auth.uid()
    );

-- Admin: Can see everyone EXCEPT founder (and their own)
-- Note: Logic is: if I am admin, I can see rows where user_role != 'founder'
-- We need a way to know if *current user* is admin/founder without joining auth.users expensive lookup.
-- Ideally, we rely on a claim or a secure function. For now, we will use a helper function if available, 
-- or assume the application protects the route and here we just filter data.
-- BUT RLS must be secure. 
-- OPTION: We'll create a simple function to get current user role from metadata if not in jwt.

create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role',
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role'
  );
$$;

create policy "Admin/Founder view logic"
    on public.admin_chat_sessions
    for select
    to authenticated
    using (
        -- Logic:
        -- 1. If I am owner of the session (covered by Staff policy? No, standardizing here)
        user_id = auth.uid()
        OR
        (
            -- 2. If I am Founder, I see everything
            get_my_role() = 'founder'
        )
        OR
        (
            -- 3. If I am Admin, I see everything EXCEPT founder's sessions
            get_my_role() = 'admin' 
            AND 
            user_role != 'founder'
        )
    );

-- Insert/Update/Delete: Users can manage their own sessions
create policy "Users manage own sessions"
    on public.admin_chat_sessions
    for all
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

-- 6. RLS Policies: admin_chat_messages
-- Inherit access from session
create policy "Messages inherit session access"
    on public.admin_chat_messages
    for select
    to authenticated
    using (
        exists (
            select 1 from public.admin_chat_sessions s
            where s.id = admin_chat_messages.session_id
        )
    );

create policy "Users manage own messages"
    on public.admin_chat_messages
    for all
    to authenticated
    using (
        exists (
            select 1 from public.admin_chat_sessions s
            where s.id = admin_chat_messages.session_id
            and s.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from public.admin_chat_sessions s
            where s.id = admin_chat_messages.session_id
            and s.user_id = auth.uid()
        )
    );

