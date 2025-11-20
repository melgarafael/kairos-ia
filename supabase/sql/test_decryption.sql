-- Teste específico de descriptografia
-- Execute este script para verificar se a descriptografia está funcionando

-- 1. Testar descriptografia de uma organização específica
-- Pode usar tanto id (master) quanto client_org_id (cliente)
-- Exemplo: AutomatikLabs - client_org_id: 139db025-4f71-4638-8cef-5e88b8690c78
WITH test_org AS (
  SELECT 
    id,
    client_org_id,
    name,
    client_anon_key_encrypted,
    client_service_key_encrypted,
    LEFT(client_anon_key_encrypted, 50) AS anon_preview,
    LEFT(client_service_key_encrypted, 50) AS service_preview
  FROM public.saas_organizations
  WHERE id = 'e2bc3205-93a8-4de5-82d4-ab19983ee845'  -- id (master) AutomatikLabs
     OR client_org_id = '139db025-4f71-4638-8cef-5e88b8690c78'  -- client_org_id AutomatikLabs
  LIMIT 1
)
SELECT 
  id,
  client_org_id,
  name,
  anon_preview,
  service_preview,
  -- Tentar descriptografar
  public.decrypt_key(client_anon_key_encrypted) AS anon_decrypted,
  public.decrypt_key(client_service_key_encrypted) AS service_decrypted,
  -- Verificar se o resultado descriptografado é um JWT válido
  CASE 
    WHEN public.decrypt_key(client_anon_key_encrypted) ~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' 
    THEN 'VALID_JWT' 
    WHEN public.decrypt_key(client_anon_key_encrypted) IS NULL 
    THEN 'NULL_RESULT'
    WHEN public.decrypt_key(client_anon_key_encrypted) = '' 
    THEN 'EMPTY_STRING'
    ELSE 'INVALID_FORMAT'
  END AS anon_decryption_status,
  CASE 
    WHEN public.decrypt_key(client_service_key_encrypted) ~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' 
    THEN 'VALID_JWT' 
    WHEN public.decrypt_key(client_service_key_encrypted) IS NULL 
    THEN 'NULL_RESULT'
    WHEN public.decrypt_key(client_service_key_encrypted) = '' 
    THEN 'EMPTY_STRING'
    ELSE 'INVALID_FORMAT'
  END AS service_decryption_status,
  -- Mostrar primeiros caracteres do resultado descriptografado (para debug)
  LEFT(public.decrypt_key(client_anon_key_encrypted), 50) AS anon_decrypted_preview,
  LEFT(public.decrypt_key(client_service_key_encrypted), 50) AS service_decrypted_preview
FROM test_org;

-- 2. Verificar se a chave de criptografia está configurada
SELECT 
  CASE WHEN encryption_key IS NULL THEN 'MISSING' ELSE 'PRESENT' END AS key_status,
  LENGTH(encryption_key) AS key_length,
  LEFT(encryption_key, 20) AS key_preview,
  updated_at
FROM public.encryption_config
WHERE id = 1;

-- 3. Testar a função get_encryption_key diretamente
SELECT public.get_encryption_key() AS encryption_key_result;

-- 4. Verificar se há erros nas funções (verificar logs do PostgreSQL)
-- Execute isso e verifique se há warnings ou erros
DO $$
DECLARE
  test_result text;
BEGIN
  -- Tentar descriptografar uma chave conhecida
  -- Pode usar tanto id quanto client_org_id
  SELECT public.decrypt_key(
    (SELECT client_anon_key_encrypted 
     FROM public.saas_organizations 
     WHERE id = 'e2bc3205-93a8-4de5-82d4-ab19983ee845'  -- id (master)
        OR client_org_id = '139db025-4f71-4638-8cef-5e88b8690c78'  -- client_org_id
     LIMIT 1)
  ) INTO test_result;
  
  RAISE NOTICE 'Decryption test result: %', 
    CASE 
      WHEN test_result IS NULL THEN 'NULL'
      WHEN test_result = '' THEN 'EMPTY'
      WHEN test_result ~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' THEN 'VALID_JWT'
      ELSE 'INVALID: ' || LEFT(test_result, 50)
    END;
END $$;

