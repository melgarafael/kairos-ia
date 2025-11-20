# 🔄 Sincronização de Migrações para master_migrations

## 📋 Visão Geral

A tabela `master_migrations` no Master Supabase armazena todos os SQLs das migrações que serão aplicadas automaticamente nos clientes via Edge Function `check-and-apply-migrations`.

## 🎯 Processo Automático

**IMPORTANTE**: Sempre que criar um novo arquivo `UPDATE-vXX-CLIENTE-SQL.md`, você deve sincronizar com a tabela `master_migrations`.

### 📝 Padrão de Nomenclatura

**TODAS as migrações devem seguir o padrão de nome:**
```
vXX - Objetivo da migration
```

Exemplos:
- ✅ `v85 - RPC para Reordenar Leads em Estágio (crm_leads_reorder_stage)`
- ✅ `v84 - Remove constraint única de telefone para permitir múltiplos leads`
- ✅ `v83 - Add cliente_messages field to ai_agent_metrics_summary function`
- ✅ `v3 - CRM Stage Normalization`

O script `sync-master-migrations.mjs` extrai automaticamente o nome seguindo este padrão:
1. Procura por comentário `-- vXX – Descrição` ou `-- vXX - Descrição`
2. Se não encontrar, usa o primeiro comentário descritivo do arquivo
3. Sempre formata como `vXX - Descrição`

### Passo 1: Criar o arquivo de update

Crie o arquivo `supabase/UPDATE-vXX-CLIENTE-SQL.md` com o SQL da migração:

```sql
-- Descrição da migração
-- Exemplo: v86 – Nova funcionalidade

-- SQL da migração aqui
CREATE TABLE ...

-- Marcar versão (esta linha será removida automaticamente)
INSERT INTO public.app_migrations (version, applied_at)
VALUES ('86', now())
ON CONFLICT (version) DO NOTHING;
```

### Passo 2: Executar o script de sincronização

Execute o script que gera o arquivo SQL para inserir na tabela `master_migrations`:

```bash
node scripts/sync-master-migrations.mjs
```

Este script:
- ✅ Lê todos os arquivos `UPDATE-vXX-CLIENTE-SQL.md`
- ✅ Extrai o SQL de cada arquivo (removendo a linha de INSERT INTO app_migrations)
- ✅ Gera um nome descritivo baseado no comentário do arquivo
- ✅ Cria um arquivo SQL em `supabase/master-migrations/` com todas as migrações

### Passo 3: Aplicar no Master Supabase

Execute o arquivo SQL gerado no Master Supabase:

1. Abra o SQL Editor do Master Supabase
2. Cole o conteúdo do arquivo gerado (ex: `20251111_sync_all_migrations_v3_to_v85.sql`)
3. Execute o SQL

Isso irá inserir/atualizar todas as migrações na tabela `master_migrations`.

## 📁 Estrutura de Arquivos

```
supabase/
├── UPDATE-vXX-CLIENTE-SQL.md          # Arquivos de migração originais
└── master-migrations/
    ├── 20251110_master_migrations_store.sql    # Criação da tabela
    ├── 20251110_seed_master_migrations_83_85.sql  # Migrações específicas
    └── 20251111_sync_all_migrations_v3_to_v85.sql # Sincronização completa
```

## 🔍 Verificação

Para verificar se as migrações estão sincronizadas:

```sql
-- No Master Supabase
SELECT version, name, length(sql) as sql_length, created_at
FROM public.master_migrations
ORDER BY version ASC;
```

## ⚠️ Notas Importantes

1. **Formato do SQL**: O script remove automaticamente a linha `INSERT INTO app_migrations` do final de cada arquivo
2. **Nome da migração**: O script tenta extrair o nome do primeiro comentário do arquivo. Se não encontrar, usa um nome padrão
3. **Delimitadores**: O script usa delimitadores únicos (`$mig_vXX$`) para evitar conflitos com `$$` no SQL
4. **Idempotência**: O SQL gerado usa `ON CONFLICT DO UPDATE`, então pode ser executado múltiplas vezes sem problemas

## 🚀 Workflow Recomendado

1. Criar novo arquivo `UPDATE-v86-CLIENTE-SQL.md` com o SQL
2. Executar `node scripts/sync-master-migrations.mjs`
3. Revisar o arquivo SQL gerado
4. Executar no Master Supabase
5. Testar aplicação automática em um cliente de teste

## 🔧 Troubleshooting

### Erro: "Arquivo está vazio"
- Verifique se o arquivo tem conteúdo SQL válido
- Certifique-se de que não está apenas com comentários

### Erro: "Nome não encontrado"
- Adicione um comentário descritivo na primeira linha do arquivo:
  ```sql
  -- v86 – Descrição da migração
  ```

### SQL não está sendo limpo corretamente
- Verifique se a linha `INSERT INTO app_migrations` está no formato esperado
- O script procura por padrões como `INSERT INTO public.app_migrations` ou `insert into public.app_migrations`

