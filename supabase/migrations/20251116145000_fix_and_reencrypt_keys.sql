-- Fix and re-encrypt keys that may have been corrupted
-- This migration fixes the decrypt_key function and ensures all keys are properly encrypted
set search_path = public, auth, pg_catalog;

begin;

-- 0. Ensure pgcrypto extension is enabled
create extension if not exists pgcrypto;

-- 1. Fix get_encryption_key - use digest with convert_to for proper bytea conversion
create or replace function public.get_encryption_key()
returns text
language plpgsql
security definer
stable
set search_path = public, auth, pg_catalog, extensions
as $$
declare
  encryption_key text;
begin
  -- Tentar obter da tabela encryption_config (mais seguro)
  begin
    select encryption_key into encryption_key
    from public.encryption_config
    where id = 1;
    
    if encryption_key is not null and encryption_key != '' then
      return encryption_key;
    end if;
  exception
    when others then
      -- Tabela não existe ou vazia, continuar
      null;
  end;
  
  -- Tentar obter de variável de ambiente (se configurada no Supabase)
  begin
    encryption_key := current_setting('app.encryption_key', true);
    if encryption_key is not null and encryption_key != '' then
      return encryption_key;
    end if;
  exception
    when others then
      null;
  end;
  
  -- Fallback: usar uma chave derivada do projeto (menos seguro, mas funciona)
  -- ⚠️ ATENÇÃO: Configure a chave na tabela encryption_config para produção!
  -- Para gerar: openssl rand -hex 32
  -- Usar convert_to para garantir que funciona corretamente com digest
  encryption_key := 'default-encryption-key-change-in-production-' || 
    encode(digest(convert_to(current_database()::text || 'fallback-key', 'UTF8'), 'sha256'), 'hex');
  
  return encryption_key;
end;
$$;

-- 2. Ensure decrypt_key function has correct search_path and handles all cases
create or replace function public.decrypt_key(ciphertext text)
returns text
language plpgsql
security definer
set search_path = public, auth, pg_catalog, extensions
as $$
declare
  key text;
  decrypted bytea;
  error_msg text;
  result text;
begin
  if ciphertext is null or ciphertext = '' then
    return null;
  end if;
  
  -- Se parece ser um JWT (formato antigo não criptografado), retornar como está
  -- Isso permite que chaves antigas ainda funcionem temporariamente
  if ciphertext ~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' then
    return ciphertext;
  end if;
  
  -- Tentar descriptografar (pode falhar se não for criptografado)
  begin
    key := public.get_encryption_key();
    if key is null or key = '' then
      raise exception 'Encryption key not configured';
    end if;
    
    decrypted := pgp_sym_decrypt(decode(ciphertext, 'base64'), key);
    result := convert_from(decrypted, 'UTF8');
    
    -- Validar que o resultado é um JWT válido
    if result is null or result = '' or not (result ~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$') then
      raise exception 'Decrypted value is not a valid JWT';
    end if;
    
    return result;
  exception
    when others then
      -- Capturar mensagem de erro para debug
      get stacked diagnostics error_msg = message_text;
      
      -- Se falhar, pode ser que seja base64 antigo (legacy)
      -- Tentar decodificar como base64 simples
      begin
        result := convert_from(decode(ciphertext, 'base64'), 'UTF8');
        
        -- Validar que o resultado é um JWT válido
        if result is null or result = '' or not (result ~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$') then
          raise exception 'Base64 decoded value is not a valid JWT';
        end if;
        
        return result;
      exception
        when others then
          -- Se ainda falhar, retornar null (chave inválida ou formato desconhecido)
          raise warning 'decrypt_key failed for ciphertext (first 50 chars): %', left(ciphertext, 50);
          return null;
      end;
  end;
end;
$$;

-- 3. Function to re-encrypt a single organization's keys
-- Aceita tanto id (UUID do master) quanto client_org_id (UUID do cliente)
create or replace function public.reencrypt_organization_keys(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_catalog, extensions
as $$
declare
  org_record record;
  anon_key_decrypted text;
  service_key_decrypted text;
  anon_key_encrypted text;
  service_key_encrypted text;
  result jsonb;
begin
  -- Buscar organização por id OU client_org_id
  select * into org_record
  from public.saas_organizations
  where id = p_org_id 
     or client_org_id = p_org_id;
  
  if not found then
    return jsonb_build_object(
      'error', 'Organization not found', 
      'org_id', p_org_id,
      'searched_by', 'id or client_org_id'
    );
  end if;
  
  result := jsonb_build_object(
    'org_id', org_record.id,
    'client_org_id', org_record.client_org_id,
    'org_name', org_record.name,
    'matched_by', case when org_record.id = p_org_id then 'id' else 'client_org_id' end,
    'anon_key_status', 'skipped',
    'service_key_status', 'skipped'
  );
  
  -- Processar anon key
  if org_record.client_anon_key_encrypted is not null then
    begin
      -- Tentar descriptografar (pode estar em formato antigo)
      anon_key_decrypted := public.decrypt_key(org_record.client_anon_key_encrypted);
      
      if anon_key_decrypted is not null and anon_key_decrypted != '' then
        -- Re-criptografar
        anon_key_encrypted := public.encrypt_key(anon_key_decrypted);
        
        if anon_key_encrypted is not null then
          update public.saas_organizations
          set client_anon_key_encrypted = anon_key_encrypted,
              updated_at = now()
          where id = p_org_id;
          
          result := result || jsonb_build_object('anon_key_status', 're-encrypted');
        else
          result := result || jsonb_build_object('anon_key_status', 'encryption_failed');
        end if;
      else
        result := result || jsonb_build_object('anon_key_status', 'decryption_failed');
      end if;
    exception
      when others then
        result := result || jsonb_build_object('anon_key_status', 'error', 'anon_error', SQLERRM);
    end;
  end if;
  
  -- Processar service key
  if org_record.client_service_key_encrypted is not null then
    begin
      -- Tentar descriptografar (pode estar em formato antigo)
      service_key_decrypted := public.decrypt_key(org_record.client_service_key_encrypted);
      
      if service_key_decrypted is not null and service_key_decrypted != '' then
        -- Re-criptografar
        service_key_encrypted := public.encrypt_key(service_key_decrypted);
        
        if service_key_encrypted is not null then
          update public.saas_organizations
          set client_service_key_encrypted = service_key_encrypted,
              updated_at = now()
          where id = p_org_id;
          
          result := result || jsonb_build_object('service_key_status', 're-encrypted');
        else
          result := result || jsonb_build_object('service_key_status', 'encryption_failed');
        end if;
      else
        result := result || jsonb_build_object('service_key_status', 'decryption_failed');
      end if;
    exception
      when others then
        result := result || jsonb_build_object('service_key_status', 'error', 'service_error', SQLERRM);
    end;
  end if;
  
  return result;
end;
$$;

-- 4. Function to re-encrypt all organizations that need it
create or replace function public.reencrypt_all_organizations()
returns table (
  org_id uuid,
  org_name text,
  anon_status text,
  service_status text,
  result jsonb
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  org_record record;
begin
  for org_record in 
    select id, name, client_anon_key_encrypted, client_service_key_encrypted
    from public.saas_organizations
    where client_anon_key_encrypted is not null or client_service_key_encrypted is not null
  loop
    declare
      reencrypt_result jsonb;
    begin
      reencrypt_result := public.reencrypt_organization_keys(org_record.id);
      
      return query select 
        org_record.id,
        org_record.name,
        reencrypt_result->>'anon_key_status',
        reencrypt_result->>'service_key_status',
        reencrypt_result;
    exception
      when others then
        return query select 
          org_record.id,
          org_record.name,
          'error'::text,
          'error'::text,
          jsonb_build_object('error', SQLERRM);
    end;
  end loop;
end;
$$;

commit;

-- Para executar a recriptografia de todas as organizações:
-- select * from public.reencrypt_all_organizations();

-- Para recriptografar uma organização específica:
-- Pode usar tanto o id (UUID do master) quanto o client_org_id (UUID do cliente):
-- select public.reencrypt_organization_keys('139db025-4f71-4638-8cef-5e88b8690c78'::uuid); -- client_org_id
-- select public.reencrypt_organization_keys('e2bc3205-93a8-4de5-82d4-ab19983ee845'::uuid); -- id (master)

