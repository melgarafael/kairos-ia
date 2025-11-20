-- Encryption migration helper
-- Usage:
--   1. Abra o SQL Editor (ou supabase cli) no ambiente desejado.
--   2. Cole este arquivo inteiro e execute.
--   3. Revise os resultados de cada bloco antes/depois da chamada.

-- 0) sanity: chave mestra persistida?
select
  case when encryption_key is null then 'MISSING' else 'PRESENT' end as key_status,
  length(encryption_key) as key_length,
  updated_at
from public.encryption_config
where id = 1;

-- 1) pré-migração – detectar valores ainda em JWT/Base64 simples
with orgs as (
  select
    count(*) as total_rows,
    count(*) filter (
      where client_anon_key_encrypted ~ '^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$'
    ) as suspected_jwt
  from public.saas_organizations
),
conns as (
  select
    count(*) as total_rows,
    count(*) filter (
      where anon_key_encrypted ~ '^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$'
         or service_role_encrypted ~ '^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$'
    ) as suspected_jwt
  from public.saas_supabases_connections
)
select 'saas_organizations' as scope, total_rows, suspected_jwt from orgs
union all
select 'saas_supabases_connections' as scope, total_rows, suspected_jwt from conns;

-- 2) executar recriptografia (usa a chave já armazenada via set_encryption_key)
select public.migrate_keys_to_encryption() as migrate_keys_to_encryption_result;

-- 3) pós-migração – repetir a checagem para garantir que não há JWT restante
with orgs as (
  select
    count(*) as total_rows,
    count(*) filter (
      where client_anon_key_encrypted ~ '^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$'
    ) as suspected_jwt
  from public.saas_organizations
),
conns as (
  select
    count(*) as total_rows,
    count(*) filter (
      where anon_key_encrypted ~ '^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$'
         or service_role_encrypted ~ '^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$'
    ) as suspected_jwt
  from public.saas_supabases_connections
)
select 'saas_organizations' as scope, total_rows, suspected_jwt from orgs
union all
select 'saas_supabases_connections' as scope, total_rows, suspected_jwt from conns;

-- 4) amostras para auditoria (valores truncados)
select
  id,
  left(client_anon_key_encrypted, 24) as anon_sample,
  left(client_service_key_encrypted, 24) as service_sample
from public.saas_organizations
where client_anon_key_encrypted is not null
order by updated_at desc
limit 5;

select
  id,
  left(anon_key_encrypted, 24) as anon_sample,
  left(service_role_encrypted, 24) as service_sample
from public.saas_supabases_connections
where anon_key_encrypted is not null
order by updated_at desc
limit 5;

