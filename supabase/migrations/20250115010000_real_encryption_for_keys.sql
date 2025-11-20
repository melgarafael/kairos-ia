-- =====================================================
-- 🔐 CRIPTOGRAFIA REAL PARA CHAVES SENSÍVEIS
-- =====================================================
-- Esta migração implementa criptografia real usando pgcrypto
-- ao invés de apenas base64. Muito mais simples e seguro!
-- =====================================================

set search_path = public, auth;

begin;

-- 1. Garantir que pgcrypto está habilitado
create extension if not exists pgcrypto;

-- 2. Remover funções antigas se existirem (para evitar conflitos)
-- Remover todas as variações possíveis de assinaturas
-- PostgreSQL precisa do tipo exato do parâmetro para DROP FUNCTION
do $$
begin
  -- Remover get_encryption_key se existir
  drop function if exists public.get_encryption_key();
  
  -- Remover encrypt_key com todas as variações possíveis
  drop function if exists public.encrypt_key(text);
  drop function if exists public.encrypt_key(key_text text);
  drop function if exists public.encrypt_key(plaintext text);
  drop function if exists public.encrypt_key(encrypted_key text);
  
  -- Remover decrypt_key com todas as variações possíveis
  drop function if exists public.decrypt_key(text);
  drop function if exists public.decrypt_key(ciphertext text);
  drop function if exists public.decrypt_key(key_text text);
  drop function if exists public.decrypt_key(encrypted_key text);
exception
  when others then
    -- Se algum drop falhar, continuar (pode não existir)
    null;
end $$;

-- 3. Criar tabela para armazenar chave de criptografia (mais simples e confiável)
-- Esta tabela armazena a chave mestra de forma segura
create table if not exists public.encryption_config (
  id int primary key default 1 check (id = 1), -- Apenas uma linha
  encryption_key text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Habilitar RLS na tabela de configuração
alter table public.encryption_config enable row level security;

-- Bloquear acesso direto à tabela (apenas service_role pode ler)
-- Usuários authenticated não podem ler a chave diretamente
create policy "Block all access to encryption config" on public.encryption_config
  for all to authenticated, anon
  using (false)
  with check (false);

-- 4. Criar função para obter chave de criptografia
-- Tenta obter da tabela primeiro, depois de variável de ambiente, depois fallback
create or replace function public.get_encryption_key()
returns text
language plpgsql
security definer
stable
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
  encryption_key := 'default-encryption-key-change-in-production-' || 
    encode(digest(current_database()::text || 'fallback-key', 'sha256'), 'hex');
  
  return encryption_key;
end;
$$;

-- 5. Função helper para configurar a chave (executar manualmente após criar a tabela)
create or replace function public.set_encryption_key(p_key text)
returns void
language plpgsql
security definer
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

-- 4. Função para criptografar chaves
create or replace function public.encrypt_key(plaintext text)
returns text
language plpgsql
security definer
as $$
declare
  key text;
  encrypted bytea;
begin
  if plaintext is null or plaintext = '' then
    return null;
  end if;
  
  key := public.get_encryption_key();
  -- pgp_sym_encrypt usa a chave como string diretamente
  encrypted := pgp_sym_encrypt(plaintext, key);
  
  -- Retornar como base64 para facilitar armazenamento
  return encode(encrypted, 'base64');
end;
$$;

-- 5. Função para descriptografar chaves (apenas para uso interno/Edge Functions)
create or replace function public.decrypt_key(ciphertext text)
returns text
language plpgsql
security definer
as $$
declare
  key text;
  decrypted bytea;
begin
  if ciphertext is null or ciphertext = '' then
    return null;
  end if;
  
  -- Tentar descriptografar (pode falhar se não for criptografado)
  begin
    key := public.get_encryption_key();
    decrypted := pgp_sym_decrypt(decode(ciphertext, 'base64'), key);
    return convert_from(decrypted, 'UTF8');
  exception
    when others then
      -- Se falhar, pode ser que seja base64 antigo (legacy)
      -- Tentar decodificar como base64 simples
      begin
        return convert_from(decode(ciphertext, 'base64'), 'UTF8');
      exception
        when others then
          -- Se ainda falhar, retornar null (chave inválida ou formato desconhecido)
          return null;
      end;
  end;
end;
$$;

-- 6. Migrar dados existentes (criptografar chaves que estão apenas em base64)
-- Esta função detecta se está em base64 simples e criptografa
create or replace function public.migrate_keys_to_encryption()
returns void
language plpgsql
security definer
as $$
declare
  org_record record;
  anon_key_decrypted text;
  service_key_decrypted text;
  anon_key_encrypted text;
  service_key_encrypted text;
begin
  -- Migrar saas_organizations
  for org_record in 
    select id, client_anon_key_encrypted, client_service_key_encrypted
    from public.saas_organizations
    where client_anon_key_encrypted is not null or client_service_key_encrypted is not null
  loop
    -- Verificar se já está criptografado (tentando descriptografar)
    -- Se falhar, significa que é base64 antigo e precisa ser migrado
    begin
      -- Tentar descriptografar anon key
      if org_record.client_anon_key_encrypted is not null then
        begin
          anon_key_decrypted := public.decrypt_key(org_record.client_anon_key_encrypted);
          -- Se chegou aqui, já está criptografado, pular
        exception
          when others then
            -- Não está criptografado, tentar decodificar base64 e re-criptografar
            begin
              anon_key_decrypted := convert_from(decode(org_record.client_anon_key_encrypted, 'base64'), 'UTF8');
              anon_key_encrypted := public.encrypt_key(anon_key_decrypted);
            exception
              when others then
                -- Se falhar ao decodificar base64, pular este registro
                continue;
            end;
            
            update public.saas_organizations
            set client_anon_key_encrypted = anon_key_encrypted
            where id = org_record.id;
        end;
      end if;
      
      -- Tentar descriptografar service key
      if org_record.client_service_key_encrypted is not null then
        begin
          service_key_decrypted := public.decrypt_key(org_record.client_service_key_encrypted);
          -- Se chegou aqui, já está criptografado, pular
        exception
          when others then
            -- Não está criptografado, tentar decodificar base64 e re-criptografar
            begin
              service_key_decrypted := convert_from(decode(org_record.client_service_key_encrypted, 'base64'), 'UTF8');
              service_key_encrypted := public.encrypt_key(service_key_decrypted);
            exception
              when others then
                -- Se falhar ao decodificar base64, pular este registro
                continue;
            end;
            
            update public.saas_organizations
            set client_service_key_encrypted = service_key_encrypted
            where id = org_record.id;
        end;
      end if;
    exception
      when others then
        -- Erro ao processar, continuar com próximo registro
        continue;
    end;
  end loop;
end;
$$;

-- 6. Executar migração dos dados existentes
-- ⚠️ ATENÇÃO: Configure app.encryption_key no Supabase Dashboard antes de executar!
-- select public.migrate_keys_to_encryption();

-- 7. Remover função antiga se existir
drop function if exists public.get_organization_credentials_decrypted(uuid, uuid);

-- 8. Criar função para obter credenciais descriptografadas (apenas para Edge Functions)
create or replace function public.get_organization_credentials_decrypted(
  p_org_id uuid,
  p_user_id uuid
)
returns table (
  client_supabase_url text,
  client_anon_key text,
  client_service_key text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  org_record record;
begin
  -- Verificar se o usuário é owner da organização
  select * into org_record
  from public.saas_organizations
  where id = p_org_id
    and owner_id = p_user_id;
  
  if not found then
    raise exception 'Unauthorized: User is not owner of this organization';
  end if;
  
  -- Retornar credenciais descriptografadas
  return query
  select 
    org_record.client_supabase_url,
    public.decrypt_key(org_record.client_anon_key_encrypted),
    public.decrypt_key(org_record.client_service_key_encrypted);
end;
$$;

-- 9. Comentários de documentação
comment on function public.encrypt_key is 
  'Criptografa uma chave usando pgcrypto. Use esta função ao salvar chaves.';

comment on function public.decrypt_key is 
  'Descriptografa uma chave. ⚠️ Use APENAS em Edge Functions/backend, nunca no frontend!';

comment on function public.get_organization_credentials_decrypted is 
  'Obtém credenciais descriptografadas. ⚠️ Use APENAS em Edge Functions com service role!';

comment on column public.saas_organizations.client_anon_key_encrypted is 
  '🔐 CRIPTOGRAFADO: Chave anon criptografada com pgcrypto. Use encrypt_key() para salvar.';

comment on column public.saas_organizations.client_service_key_encrypted is 
  '🔐 CRIPTOGRAFADO: Service role key criptografada com pgcrypto. Use encrypt_key() para salvar.';

-- 10. Permitir que authenticated possa ler os campos criptografados
-- Agora que está realmente criptografado com pgcrypto, podemos permitir acesso direto à tabela
-- porque mesmo que alguém veja o valor criptografado no DevTools, não consegue descriptografar
-- sem a chave mestra (que está apenas no servidor)
drop policy if exists "Block all authenticated direct access" on public.saas_organizations;
drop policy if exists "Block authenticated insert" on public.saas_organizations;
drop policy if exists "Block authenticated update" on public.saas_organizations;
drop policy if exists "Block authenticated delete" on public.saas_organizations;
drop policy if exists "Allow read for owners and members" on public.saas_organizations;

-- Recriar política que permite acesso controlado (agora seguro porque está criptografado)
-- Mesmo que alguém veja client_service_key_encrypted no DevTools, é apenas texto criptografado
create policy "Allow read for owners and members" on public.saas_organizations
  for select to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1
      from public.saas_memberships m
      where m.saas_user_id = auth.uid()
        and m.status = 'active'
        and (
          m.organization_id_in_client = public.saas_organizations.client_org_id
          or m.organization_id_in_client = public.saas_organizations.id
        )
    )
  );

commit;

-- =====================================================
-- 📝 INSTRUÇÕES DE CONFIGURAÇÃO
-- =====================================================
-- 
-- 1. Gerar chave de criptografia:
--    openssl rand -hex 32
--    (ou use qualquer string aleatória de pelo menos 32 caracteres)
--
-- 2. Configurar a chave no banco (execute no SQL Editor):
--    select public.set_encryption_key('SUA_CHAVE_AQUI');
--    
--    Exemplo:
--    select public.set_encryption_key('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6');
--
-- 3. Executar migração dos dados existentes:
--    select public.migrate_keys_to_encryption();
--
-- 4. Verificar se funcionou:
--    select 
--      id, 
--      name,
--      client_service_key_encrypted,
--      decrypt_key(client_service_key_encrypted) as decrypted_test
--    from saas_organizations
--    limit 1;
--
-- 5. Atualize o código para usar encrypt_key() ao salvar chaves
--    e decrypt_key() apenas em Edge Functions
-- =====================================================

