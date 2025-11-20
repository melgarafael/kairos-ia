-- v64 – Hotfix: normalização de email e remoção de dedupe destrutivo

begin;

-- 1) Corrigir função de normalização de email (vazio -> null)
create or replace function public.normalize_email(p text) returns text
language sql immutable as $$
  select case
           when p is null or trim(p) = '' then null
           else lower(trim(p))
         end
$$;

-- 2) Forçar recomputar colunas geradas (email_normalized)
-- (em colunas GENERATED STORED, um update que reescreve o mesmo valor reavalia a expressão)
update public.crm_leads set email = email;

-- 3) Remover quaisquer blocos de deduplicação destrutivos futuros (documentação)
-- Nenhuma ação DDL aqui; a recomendação é não reexecutar deletes por rn>1.

commit;

-- Marcar versão
insert into public.app_migrations (version, applied_at)
values ('64', now())
on conflict (version) do nothing;


