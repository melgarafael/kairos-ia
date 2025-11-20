BEGIN;

-- v51 – Agent Prompts: adicionar campos JSONB para Output Format, RLHF e Few-Shots
alter table if exists public.agent_prompts
  add column if not exists output_format jsonb default '{}'::jsonb,
  add column if not exists rhf_feedbacks jsonb default '[]'::jsonb,
  add column if not exists fewshots_examples jsonb default '[]'::jsonb;

COMMIT;

-- Marcar versão
insert into public.app_migrations (version, applied_at)
values ('51', now())
on conflict (version) do nothing;

