# 📝 Memória: Padrão de Nomenclatura de Migrações

## 🎯 Padrão Obrigatório

**TODAS as migrações na tabela `master_migrations` DEVEM seguir o padrão:**

```
vXX - Objetivo da migration
```

Onde:
- `vXX` = número da versão (ex: v3, v85, v86)
- `-` = hífen com espaços
- `Objetivo da migration` = descrição clara e concisa do que a migração faz

## ✅ Exemplos Corretos

- `v85 - RPC para Reordenar Leads em Estágio (crm_leads_reorder_stage)`
- `v84 - Remove constraint única de telefone para permitir múltiplos leads`
- `v83 - Add cliente_messages field to ai_agent_metrics_summary function`
- `v3 - CRM Stage Normalization`

## ❌ Exemplos Incorretos

- ❌ `v85 – RPC crm_leads_reorder_stage` (sem hífen padrão, usando en-dash)
- ❌ `Migration 85` (sem prefixo vXX)
- ❌ `v85 RPC para Reordenar` (sem hífen)
- ❌ `85 - RPC para Reordenar` (sem prefixo 'v')

## 🔧 Como Garantir o Padrão

### Ao Criar Novo Arquivo UPDATE-vXX-CLIENTE-SQL.md

**Sempre comece o arquivo com:**

```sql
-- vXX - Descrição clara e objetiva da migração
```

Exemplo:
```sql
-- v86 - Adicionar campo novo_campo na tabela exemplo
```

### Script Automático

O script `scripts/sync-master-migrations.mjs` **automaticamente**:
1. Extrai o nome seguindo o padrão `vXX - Descrição`
2. Garante que todos os nomes sigam o formato correto
3. Usa fallbacks inteligentes se o padrão não for encontrado

### Verificação

Após executar o script de sincronização, verifique:

```sql
-- No Master Supabase
SELECT version, name 
FROM public.master_migrations 
WHERE name NOT LIKE 'v% - %'
ORDER BY version;
```

Se retornar linhas, os nomes não estão no padrão correto.

## 📋 Checklist para Nova Migração

- [ ] Criar arquivo `UPDATE-vXX-CLIENTE-SQL.md`
- [ ] Primeira linha: `-- vXX - Descrição clara`
- [ ] Executar `node scripts/sync-master-migrations.mjs`
- [ ] Verificar que o nome gerado segue o padrão `vXX - Descrição`
- [ ] Executar SQL gerado no Master Supabase
- [ ] Verificar na tabela `master_migrations` que o nome está correto

## 🎯 Importância

Este padrão é importante porque:
1. **Consistência**: Facilita leitura e manutenção
2. **Busca**: Permite filtrar por versão facilmente
3. **Clareza**: Nome descritivo ajuda a entender o que cada migração faz
4. **Automação**: Scripts podem depender deste padrão

