-- Master Migration: Registrar versão 78 (Kanban Performance) no Master
-- Esta migration atualiza a tabela app_migrations no Master Supabase
-- para que o sistema detecte que a versão 78 está disponível

SET search_path = public;

-- Garantir que a tabela existe (idempotente)
create table if not exists public.app_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

-- Registrar versão 78
insert into public.app_migrations (version, applied_at)
values ('78', now())
on conflict (version) do update set applied_at = now();

