-- Script de diagnóstico para problemas de descriptografia
-- Execute este script no SQL Editor do Supabase Master

-- 1. Verificar se a chave de criptografia está configurada
select
  case when encryption_key is null then 'MISSING' else 'PRESENT' end as key_status,
  length(encryption_key) as key_length,
  updated_at
from public.encryption_config
where id = 1;

-- 2. Verificar se as funções de criptografia existem e têm search_path correto
select 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_def
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('decrypt_key', 'encrypt_key', 'get_encryption_key')
order by p.proname;

-- 3. Testar descriptografia em uma organização específica (substitua o ID)
-- Substitua '139db025-4f71-4638-8cef-5e88b8690c78' pelo ID da organização com problema
with test_org as (
  select 
    id,
    name,
    client_anon_key_encrypted,
    client_service_key_encrypted,
    left(client_anon_key_encrypted, 50) as anon_preview,
    left(client_service_key_encrypted, 50) as service_preview
  from public.saas_organizations
  where id = '139db025-4f71-4638-8cef-5e88b8690c78'  -- Substitua pelo ID real
)
select 
  id,
  name,
  anon_preview,
  service_preview,
  -- Tentar descriptografar
  public.decrypt_key(client_anon_key_encrypted) as anon_decrypted,
  public.decrypt_key(client_service_key_encrypted) as service_decrypted,
  -- Verificar se parece ser JWT (deve ter pontos)
  case 
    when client_anon_key_encrypted ~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' 
    then 'JWT_FORMAT (não criptografado)' 
    else 'ENCRYPTED_FORMAT' 
  end as anon_format,
  case 
    when client_service_key_encrypted ~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' 
    then 'JWT_FORMAT (não criptografado)' 
    else 'ENCRYPTED_FORMAT' 
  end as service_format
from test_org;

-- 4. Verificar quantas organizações têm chaves em formato JWT (não criptografadas)
select 
  count(*) as total_orgs,
  count(*) filter (
    where client_anon_key_encrypted ~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
  ) as anon_keys_in_jwt_format,
  count(*) filter (
    where client_service_key_encrypted ~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
  ) as service_keys_in_jwt_format
from public.saas_organizations
where client_anon_key_encrypted is not null or client_service_key_encrypted is not null;

-- 5. Listar organizações com chaves que podem precisar de recriptografia
select 
  id,
  name,
  case 
    when client_anon_key_encrypted ~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' 
    then 'NEEDS_ENCRYPTION' 
    else 'OK' 
  end as anon_status,
  case 
    when client_service_key_encrypted ~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' 
    then 'NEEDS_ENCRYPTION' 
    else 'OK' 
  end as service_status
from public.saas_organizations
where client_anon_key_encrypted is not null or client_service_key_encrypted is not null
order by updated_at desc
limit 10;

