-- v64 Hotfix (migration): corrigir normalize_email e backfill

create or replace function public.normalize_email(p text) returns text
language sql immutable as $$
  select case
           when p is null or trim(p) = '' then null
           else lower(trim(p))
         end
$$;

-- Forçar recompute das colunas geradas
update public.crm_leads set email = email;

-- (Não executar dedupe destrutivo)


