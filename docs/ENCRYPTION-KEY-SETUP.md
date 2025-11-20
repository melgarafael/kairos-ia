# 🔐 Como Configurar a Chave de Criptografia

## Método Simples (Recomendado)

### 1. Gerar uma Chave Segura

No terminal, execute:
```bash
openssl rand -hex 32
```

Isso gerará algo como:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### 2. Configurar no Supabase SQL Editor

1. Abra o **Supabase Dashboard**
2. Vá para **SQL Editor** (no menu lateral)
3. Execute este comando (substitua `SUA_CHAVE_AQUI` pela chave gerada):

```sql
select public.set_encryption_key('SUA_CHAVE_AQUI');
```

**Exemplo:**
```sql
select public.set_encryption_key('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2');
```

### 3. Verificar se Funcionou

```sql
-- Verificar se a chave foi salva (deve retornar 1 linha)
select id, length(encryption_key) as key_length, created_at 
from public.encryption_config;
```

### 4. Migrar Dados Existentes

Depois de configurar a chave, execute a migração:

```sql
select public.migrate_keys_to_encryption();
```

Isso vai criptografar todas as chaves que estão apenas em base64.

## Onde Está Armazenada?

A chave é armazenada na tabela `encryption_config`:
- ✅ Protegida por RLS (apenas service_role pode ler)
- ✅ Apenas uma linha (id = 1)
- ✅ Nunca exposta ao frontend

## Segurança

- A tabela `encryption_config` tem RLS que bloqueia acesso para `authenticated`
- Apenas `service_role` (usado por Edge Functions) pode ler a chave
- Mesmo que alguém veja o valor criptografado no DevTools, não consegue descriptografar sem a chave mestra

## Atualizar a Chave

Se precisar trocar a chave (por exemplo, em caso de comprometimento):

```sql
-- 1. Configurar nova chave
select public.set_encryption_key('NOVA_CHAVE_AQUI');

-- 2. Re-criptografar todos os dados com a nova chave
-- (Isso requer descriptografar com a chave antiga e re-criptografar com a nova)
-- ⚠️ ATENÇÃO: Isso é complexo e requer cuidado!
```

## Troubleshooting

**Erro: "chave de criptografia deve ter pelo menos 32 caracteres"**
- Use uma chave maior (recomendado: 64 caracteres hex)

**Erro ao descriptografar:**
- Verifique se a chave está configurada corretamente
- Verifique se os dados foram migrados: `select public.migrate_keys_to_encryption();`

**Chave não encontrada:**
- Execute: `select public.set_encryption_key('sua-chave-aqui');`
- Verifique: `select * from public.encryption_config;`

