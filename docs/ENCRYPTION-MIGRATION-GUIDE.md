# 🔐 Guia de Migração para Criptografia Real

## Por que Criptografia Real?

A solução anterior (bloquear acesso via RLS) era complexa e ainda permitia que valores criptografados fossem vistos (mesmo que não pudessem ser usados). 

**Criptografia real é muito melhor porque:**
- ✅ Simples: apenas criptografa ao salvar, descriptografa ao usar
- ✅ Seguro: mesmo que alguém veja o valor criptografado, não consegue descriptografar sem a chave mestra
- ✅ Permite acesso direto à tabela: não precisa de views/funções complexas
- ✅ Compatível com dados legacy: migra automaticamente chaves em base64

## Passo a Passo

### 1. Gerar Chave de Criptografia

```bash
# Gerar chave segura de 64 caracteres hexadecimais
openssl rand -hex 32
```

### 2. Configurar no Supabase Dashboard

1. Vá para **Settings > Database**
2. Role até **Custom Config** (ou **Database Settings > Custom Config**)
3. Clique em **Add new config** ou **New Config**
4. Configure:
   - **Key**: `app.encryption_key`
   - **Value**: [cole a chave gerada acima]
5. Salve

### 3. Executar Migração

Execute a migração SQL:
```sql
-- Arquivo: supabase/migrations/20250115010000_real_encryption_for_keys.sql
```

Isso criará:
- Função `encrypt_key()` - para criptografar chaves
- Função `decrypt_key()` - para descriptografar (apenas backend)
- Função `migrate_keys_to_encryption()` - para migrar dados existentes

### 4. Migrar Dados Existentes

```sql
-- Executar migração dos dados existentes
select public.migrate_keys_to_encryption();
```

Isso detectará automaticamente chaves que estão apenas em base64 e as criptografará.

### 5. Verificar

```sql
-- Verificar se as chaves foram criptografadas
select 
  id,
  name,
  client_anon_key_encrypted,
  client_service_key_encrypted,
  -- Tentar descriptografar (deve funcionar se estiver criptografado)
  decrypt_key(client_anon_key_encrypted) as anon_decrypted,
  decrypt_key(client_service_key_encrypted) as service_decrypted
from saas_organizations
limit 1;
```

## Como Funciona

### Salvar Chave (Edge Function)

```typescript
// Antes (base64 - inseguro)
const encrypted = btoa(serviceRoleKey)

// Agora (criptografia real - seguro)
const { data: encrypted } = await supabase.rpc('encrypt_key', {
  plaintext: serviceRoleKey
})
```

### Ler Chave (Edge Function)

```typescript
// Antes (base64 - inseguro)
const key = atob(encryptedKey)

// Agora (criptografia real - seguro)
const { data: decrypted } = await supabase.rpc('decrypt_key', {
  ciphertext: encryptedKey
})
```

### Frontend

O frontend **NUNCA** deve receber chaves descriptografadas diretamente. Sempre use Edge Functions que descriptografam internamente.

## Segurança

- ✅ **Criptografia AES-256** via pgcrypto
- ✅ **Chave mestra** armazenada no Supabase (não no código)
- ✅ **Compatibilidade** com dados legacy (base64)
- ✅ **Acesso direto permitido**: valores criptografados são seguros mesmo se vistos

## Vantagens sobre RLS Complexo

| Aspecto | RLS Complexo | Criptografia Real |
|---------|--------------|-------------------|
| Complexidade | Alta (views, funções, políticas) | Baixa (apenas 2 funções) |
| Performance | Múltiplas camadas | Direto |
| Manutenção | Difícil | Fácil |
| Segurança | Boa (bloqueia acesso) | Excelente (criptografa dados) |
| Compatibilidade | Quebra código existente | Compatível com legacy |

## Rollback (se necessário)

Se precisar reverter para base64:

```sql
-- Descriptografar e converter para base64
update saas_organizations
set client_service_key_encrypted = encode(
  convert_to(decrypt_key(client_service_key_encrypted), 'UTF8')::bytea,
  'base64'
)
where client_service_key_encrypted is not null
  and decrypt_key(client_service_key_encrypted) is not null;
```

**⚠️ AVISO**: Rollback expõe chaves novamente. Use apenas em emergências.

