-- =====================================================
-- 🔐 Criptografia real para saas_supabases_connections
-- =====================================================
-- Este script garante que as chaves salvas no repositório
-- (anon/service role) sejam persistidas de forma criptografada
-- usando as funções encrypt_key/decrypt_key (pgcrypto).
-- =====================================================

set search_path = extensions, pg_catalog, public, auth;

begin;

create extension if not exists pgcrypto with schema extensions;

-- Atualizar get_encryption_key para usar digest corretamente (bytea + cast explícito)
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
  -- Tenta obter da tabela encryption_config
  begin
    select encryption_key
      into encryption_key
    from public.encryption_config
    where id = 1;

    if encryption_key is not null and encryption_key != '' then
      return encryption_key;
    end if;
  exception
    when others then
      null;
  end;

  -- Tenta obter da config app.encryption_key
  begin
    encryption_key := current_setting('app.encryption_key', true);
    if encryption_key is not null and encryption_key != '' then
      return encryption_key;
    end if;
  exception
    when others then
      null;
  end;

  -- Fallback derivado do nome do banco (somente para dev)
  encryption_key := 'default-encryption-key-change-in-production-' ||
    encode(
      digest(
        convert_to(current_database() || 'fallback-key', 'UTF8'),
        'sha256'::text
      ),
      'hex'
    );

  return encryption_key;
end;
$$;

-- Função auxiliar: garante que um valor esteja criptografado.
create or replace function public.ensure_key_encrypted(p_value text)
returns text
language plpgsql
security definer
stable
set search_path = public, auth, pg_catalog, extensions
as $$
declare
  key text;
  decrypted bytea;
  plaintext text;
begin
  if p_value is null or trim(p_value) = '' then
    return null;
  end if;

  key := public.get_encryption_key();

  -- 1) Tentar descriptografar com pgcrypto.
  --    Se funcionar, o valor já está criptografado -> retornar como está.
  begin
    decrypted := pgp_sym_decrypt(decode(p_value, 'base64'), key);
    return p_value;
  exception
    when others then
      -- Ignorar: significa que ainda não está criptografado.
      null;
  end;

  -- 2) Tentar interpretar como base64 simples (legado).
  begin
    plaintext := convert_from(decode(p_value, 'base64'), 'UTF8');
  exception
    when others then
      plaintext := p_value;
  end;

  return public.encrypt_key(plaintext);
end;
$$;

-- Recriar trigger de before insert/update com criptografia automática.
create or replace function public.ssc_before_ins_upd()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    if new.project_ref is null then
      new.project_ref := public.extract_project_ref(new.supabase_url);
    end if;
  elsif TG_OP = 'UPDATE' then
    if new.supabase_url is distinct from old.supabase_url
       and (new.project_ref is null or new.project_ref = old.project_ref) then
      new.project_ref := public.extract_project_ref(new.supabase_url);
    end if;
  end if;

  if new.anon_key_encrypted is not null then
    new.anon_key_encrypted := public.ensure_key_encrypted(new.anon_key_encrypted);
  end if;

  if new.service_role_encrypted is not null then
    new.service_role_encrypted := public.ensure_key_encrypted(new.service_role_encrypted);
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ssc_biu on public.saas_supabases_connections;
create trigger ssc_biu
before insert or update on public.saas_supabases_connections
for each row execute function public.ssc_before_ins_upd();

-- Migrar dados existentes (Base64 -> criptografado).
update public.saas_supabases_connections
set anon_key_encrypted = public.ensure_key_encrypted(anon_key_encrypted)
where anon_key_encrypted is not null;

update public.saas_supabases_connections
set service_role_encrypted = public.ensure_key_encrypted(service_role_encrypted)
where service_role_encrypted is not null;

comment on column public.saas_supabases_connections.anon_key_encrypted is 
  '🔐 Persistido criptografado com pgcrypto. Use encrypt_key()/ensure_key_encrypted() para salvar.';

comment on column public.saas_supabases_connections.service_role_encrypted is 
  '🔐 Persistido criptografado com pgcrypto. Use encrypt_key()/ensure_key_encrypted() para salvar.';

-- Atualizar função de migração legado para incluir o repositório.
create or replace function public.migrate_keys_to_encryption()
returns void
language plpgsql
security definer
as $$
declare
  org_record record;
  conn_record record;
begin
  -- Organizações (já existente)
  for org_record in 
    select id, client_anon_key_encrypted, client_service_key_encrypted
    from public.saas_organizations
    where client_anon_key_encrypted is not null or client_service_key_encrypted is not null
  loop
    update public.saas_organizations
    set client_anon_key_encrypted = public.ensure_key_encrypted(client_anon_key_encrypted),
        client_service_key_encrypted = public.ensure_key_encrypted(client_service_key_encrypted)
    where id = org_record.id;
  end loop;

  -- Repositório de conexões do owner.
  for conn_record in 
    select id, anon_key_encrypted, service_role_encrypted
    from public.saas_supabases_connections
    where anon_key_encrypted is not null or service_role_encrypted is not null
  loop
    update public.saas_supabases_connections
    set anon_key_encrypted = public.ensure_key_encrypted(anon_key_encrypted),
        service_role_encrypted = public.ensure_key_encrypted(service_role_encrypted)
    where id = conn_record.id;
  end loop;
end;
$$;

commit;


