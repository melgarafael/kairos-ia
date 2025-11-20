# 🚀 Executar Sincronização de Migrações no Master Supabase

## ⚠️ Situação Atual

A tabela `master_migrations` no Master Supabase atualmente contém apenas:
- ✅ v83
- ✅ v84  
- ✅ v85

Mas o arquivo SQL gerado contém **82 migrações** (v3 até v85).

## 📋 Passo a Passo para Executar

### 1. Abrir o SQL Editor do Master Supabase

1. Acesse o dashboard do Master Supabase
2. Vá em **SQL Editor** (menu lateral)
3. Clique em **New Query**

### 2. Copiar o Conteúdo do Arquivo

O arquivo está em:
```
supabase/master-migrations/20251111_sync_all_migrations_v3_to_v85.sql
```

**Opção 1: Copiar via terminal**
```bash
cat supabase/master-migrations/20251111_sync_all_migrations_v3_to_v85.sql | pbcopy
```

**Opção 2: Abrir o arquivo no editor e copiar tudo (Cmd+A, Cmd+C)**

### 3. Colar e Executar no SQL Editor

1. Cole o conteúdo no SQL Editor do Master Supabase
2. Clique em **Run** ou pressione `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows/Linux)
3. Aguarde a execução (pode levar alguns segundos devido ao tamanho)

### 4. Verificar Resultado

Execute esta query para verificar:

```sql
SELECT version, name, length(sql) as sql_length, created_at
FROM public.master_migrations
ORDER BY version ASC;
```

Você deve ver **82 linhas** (versões de 3 até 85).

## 🔍 Verificação Rápida

```sql
-- Contar total de migrações
SELECT COUNT(*) as total FROM public.master_migrations;

-- Ver versões mínima e máxima
SELECT MIN(version) as min_version, MAX(version) as max_version 
FROM public.master_migrations;

-- Ver últimas 5 migrações
SELECT version, name 
FROM public.master_migrations 
ORDER BY version DESC 
LIMIT 5;
```

## ⚠️ Possíveis Problemas

### Erro: "delimiter $mig_vXX$ not found"
- O PostgreSQL pode ter problemas com delimitadores customizados
- Solução: Verifique se está usando PostgreSQL 12+ ou ajuste o delimitador

### Erro: "string too long"
- Algumas migrações podem ter SQL muito grande
- Solução: O arquivo já usa delimitadores adequados, mas se persistir, execute em partes menores

### Timeout
- O arquivo é grande (9434 linhas)
- Solução: Execute em partes ou aumente o timeout do SQL Editor

## ✅ Após Executar

Depois de executar com sucesso, a Edge Function `check-and-apply-migrations` terá acesso a todas as migrações e poderá aplicá-las automaticamente nos clientes.

