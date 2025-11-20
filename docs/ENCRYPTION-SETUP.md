# 🔐 Configuração de Criptografia Real para Chaves

## Visão Geral

Agora as chaves do Supabase são criptografadas usando `pgcrypto` (AES-256) ao invés de apenas base64. Isso é **muito mais seguro** e **mais simples** do que tentar bloquear acesso via RLS.

## Como Funciona

1. **Criptografia**: Chaves são criptografadas com `pgcrypto` usando uma chave mestra
2. **Armazenamento**: Chaves criptografadas são armazenadas no banco
3. **Descriptografia**: Apenas Edge Functions podem descriptografar (usando `decrypt_key()`)
4. **Frontend**: Nunca recebe chaves descriptografadas diretamente

## Configuração

### 1. Gerar Chave de Criptografia

```bash
# Gerar uma chave segura de 32 bytes (64 caracteres hex)
openssl rand -hex 32
```

### 2. Configurar no Supabase Dashboard

1. Vá para **Settings > Database**
2. Role até **Custom Config**
3. Clique em **Add new config**
4. Configure:
   - **Key**: `app.encryption_key`
   - **Value**: [cole a chave gerada acima]

### 3. Executar Migração

```sql
-- Executar a migração SQL
-- Isso criará as funções de criptografia

-- Migrar dados existentes (criptografar chaves que estão apenas em base64)
select public.migrate_keys_to_encryption();
```

## Uso

### Salvar Chave (Edge Function)

```typescript
// Criptografar antes de salvar
const { data: encrypted } = await supabase.rpc('encrypt_key', {
  plaintext: serviceRoleKey
})

await supabase
  .from('saas_organizations')
  .update({ client_service_key_encrypted: encrypted })
  .eq('id', orgId)
```

### Ler Chave (Edge Function)

```typescript
// Descriptografar ao ler
const { data: decrypted } = await supabase.rpc('decrypt_key', {
  ciphertext: encryptedKey
})

// Usar chave descriptografada
const client = createClient(url, decrypted)
```

### Frontend

O frontend **NUNCA** deve receber chaves descriptografadas diretamente. Sempre use Edge Functions que descriptografam internamente.

## Migração de Dados Existentes

A função `migrate_keys_to_encryption()` detecta automaticamente chaves que estão apenas em base64 e as criptografa. Execute uma vez após configurar a chave:

```sql
select public.migrate_keys_to_encryption();
```

## Segurança

- ✅ Chaves são criptografadas com AES-256
- ✅ Chave mestra armazenada no Supabase (não no código)
- ✅ Frontend nunca recebe chaves descriptografadas
- ✅ Compatibilidade com dados legacy (base64) durante migração

## Rollback (se necessário)

Se precisar reverter para base64:

```sql
-- Descriptografar e converter para base64
update saas_organizations
set client_service_key_encrypted = encode(
  convert_to(decrypt_key(client_service_key_encrypted), 'UTF8')::bytea,
  'base64'
)
where client_service_key_encrypted is not null;
```

**⚠️ AVISO**: Rollback expõe chaves novamente. Use apenas em emergências.

