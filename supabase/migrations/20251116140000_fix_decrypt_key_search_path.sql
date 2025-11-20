-- Fix decrypt_key function search_path and ensure proper error handling
-- This fixes the issue where decrypt_key was not working correctly after search_path migrations
set search_path = public, auth;

begin;

-- Recreate decrypt_key with explicit search_path and better error handling
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

-- Recreate encrypt_key with explicit search_path
create or replace function public.encrypt_key(plaintext text)
returns text
language plpgsql
security definer
set search_path = public, auth, pg_catalog, extensions
as $$
declare
  key text;
  encrypted bytea;
begin
  if plaintext is null or plaintext = '' then
    return null;
  end if;
  
  key := public.get_encryption_key();
  if key is null or key = '' then
    raise exception 'Encryption key not configured';
  end if;
  
  -- pgp_sym_encrypt usa a chave como string diretamente
  encrypted := pgp_sym_encrypt(plaintext, key);
  
  -- Retornar como base64 para facilitar armazenamento
  return encode(encrypted, 'base64');
end;
$$;

-- Ensure pgcrypto extension is enabled
create extension if not exists pgcrypto;

-- Recreate get_encryption_key with explicit search_path
-- Usa convert_to para garantir conversão correta para bytea antes de digest
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

-- Ensure set_encryption_key also has correct search_path
create or replace function public.set_encryption_key(p_key text)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
begin
  if p_key is null or length(p_key) < 32 then
    raise exception 'Chave de criptografia deve ter pelo menos 32 caracteres';
  end if;
  
  insert into public.encryption_config (id, encryption_key, updated_at)
  values (1, p_key, now())
  on conflict (id) do update
  set encryption_key = p_key, updated_at = now();
end;
$$;

commit;

