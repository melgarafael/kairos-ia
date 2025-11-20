# 🔧 Correção: Timeout em Admin Analytics

## 🚨 Problemas Identificados

1. **Feature Rank Error**: `canceling statement due to statement timeout`
   - A função `feature_rank` estava fazendo múltiplas queries com `COUNT DISTINCT` sem filtrar adequadamente antes de agrupar
   - Isso causava scan completo da tabela `saas_events` antes de aplicar filtros de data

2. **DAU Metric Error**: Timeout na query de Daily Active Users
   - A view `v_daily_active_users_features` estava fazendo `GROUP BY` em toda a tabela sem filtros de data
   - Quando havia muitos eventos, a query demorava muito e causava timeout

## ✅ Soluções Implementadas

### 1. Otimização da Função `feature_rank`

**Arquivo**: `supabase/migrations/20251112000001_optimize_admin_analytics_queries.sql`

**Mudanças**:
- Filtra eventos por data **ANTES** de fazer `GROUP BY` e `COUNT DISTINCT`
- Usa CTE `filtered_events` para reduzir o dataset antes de processar
- Adiciona `LIMIT 100` para evitar result sets muito grandes
- Adiciona índices específicos para otimizar as queries

**Antes**:
```sql
-- Fazia COUNT DISTINCT em toda a tabela antes de filtrar
SELECT count(distinct user_id) FROM saas_events WHERE ...
```

**Depois**:
```sql
-- Filtra primeiro, depois agrupa
WITH filtered_events AS (
  SELECT ... FROM saas_events 
  WHERE created_at >= p_from AND created_at <= p_to
)
SELECT count(distinct user_id) FROM filtered_events ...
```

### 2. Nova RPC Function para DAU

**Função**: `daily_active_users_features(p_from, p_to)`

**Benefícios**:
- Filtra por data **ANTES** de fazer `GROUP BY`
- Muito mais rápido que a view que agrupa tudo primeiro
- Retorna apenas os dados do período solicitado

### 3. Tratamento de Timeout na Edge Function

**Arquivo**: `supabase/functions/admin-analytics/index.ts`

**Mudanças**:
- Adiciona timeout de 25 segundos para a query `feature_rank`
- Se timeout ocorrer, retorna array vazio em vez de quebrar toda a requisição
- Adiciona fallback para view caso a RPC não exista ainda
- Melhor tratamento de erros com logs detalhados

### 4. Índices Otimizados

**Novos índices criados**:
- `saas_events_event_name_created_at_idx`: Para filtros por event_name + data
- `saas_events_props_feature_idx`: GIN index para extração de feature do JSONB
- `saas_events_user_created_idx`: Para cálculos de DAU por usuário

## 📋 Como Aplicar

### Passo 1: Aplicar Migration SQL

Execute a migration no **Master Supabase** (qckjiolragbvvpqvfhrj):

```bash
# Opção 1: Via Supabase CLI
npx supabase db push

# Opção 2: Via Dashboard
# 1. Acesse https://supabase.com/dashboard/project/qckjiolragbvvpqvfhrj
# 2. Vá em SQL Editor
# 3. Cole o conteúdo de: supabase/migrations/20251112000001_optimize_admin_analytics_queries.sql
# 4. Execute
```

### Passo 2: Deploy da Edge Function

```bash
cd /Users/rafaelmelgaco/Downloads/tomikcrm
npx supabase functions deploy admin-analytics
```

### Passo 3: Testar

1. Acesse o Admin Analytics no app
2. Selecione um período de datas (ex: últimos 30 dias)
3. Verifique se:
   - ✅ DAU carrega sem timeout
   - ✅ Feature Rank carrega sem timeout
   - ✅ Outras métricas continuam funcionando

## 🔍 Verificação

Se ainda houver problemas, verifique:

1. **Índices foram criados?**
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'saas_events' 
  AND indexname LIKE '%event%' OR indexname LIKE '%feature%';
```

2. **Funções foram criadas?**
```sql
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN ('feature_rank', 'daily_active_users_features');
```

3. **Logs da Edge Function**
```bash
npx supabase functions logs admin-analytics --follow
```

## 📊 Performance Esperada

**Antes**:
- Feature Rank: 30+ segundos (timeout)
- DAU: 20+ segundos (timeout)

**Depois**:
- Feature Rank: < 5 segundos (com timeout de 25s como segurança)
- DAU: < 2 segundos

## 🚨 Notas Importantes

1. **Fallback Automático**: A edge function tem fallback para a view caso a RPC não exista ainda
2. **Graceful Degradation**: Se `feature_rank` der timeout, retorna array vazio em vez de quebrar toda a requisição
3. **Índices**: Os índices podem levar alguns minutos para serem criados em tabelas grandes. Aguarde antes de testar.

## 📝 Arquivos Modificados

1. `supabase/migrations/20251112000001_optimize_admin_analytics_queries.sql` (novo)
2. `supabase/functions/admin-analytics/index.ts` (modificado)

