-- Migration: Create admin_ai_audit table
-- Date: 2025-11-20
-- Description: Creates table for storing AI agent audit logs.

create table if not exists public.admin_ai_audit (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete set null,
    event text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_admin_ai_audit_user_id on public.admin_ai_audit(user_id);
create index if not exists idx_admin_ai_audit_created_at on public.admin_ai_audit(created_at desc);
create index if not exists idx_admin_ai_audit_event on public.admin_ai_audit(event);

-- RLS
alter table public.admin_ai_audit enable row level security;

-- Policies
-- Service Role can insert (used by API)
-- Admins/Founders can select (for audit dashboard)

create policy "Service role can manage audit logs"
    on public.admin_ai_audit
    for all
    to service_role
    using (true)
    with check (true);

create policy "Admins can view audit logs"
    on public.admin_ai_audit
    for select
    to authenticated
    using (
        exists (
            select 1 from public.saas_admins
            where saas_admins.user_id = auth.uid()
        )
        OR
        (select ((current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role')) = 'founder')
    );

