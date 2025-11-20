# 🏢 MASTER SUPABASE - Setup Completo

## 📋 ORDEM DE EXECUÇÃO

Execute os arquivos **NA ORDEM EXATA** no seu **MASTER SUPABASE**:

### **1. Configurações Base**
```sql
\i 01-master-extensions.sql
```

### **2. Sistema de Planos**
```sql
\i 02-master-plans.sql
```

### **3. Organizações**
```sql
\i 03-master-organizations.sql
```

### **4. Usuários SaaS**
```sql
\i 04-master-users.sql
```

### **5. Sessões e Auth**
```sql
\i 05-master-sessions.sql
```

### **6. Funções de Auth**
```sql
\i 06-master-functions.sql
\i 07-master-rpc-functions.sql
```

## ✅ Verificação

Após executar todos os SQLs, verifique:

```sql
-- Verificar tabelas criadas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verificar funções criadas
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
ORDER BY routine_name;

-- Verificar planos inseridos
SELECT name, slug, price_monthly FROM saas_plans;
```

## 🔧 Configuração no Frontend

Adicione no `.env`:
```
VITE_MASTER_SUPABASE_URL=https://seu-master.supabase.co
VITE_MASTER_SUPABASE_ANON_KEY=sua_chave_master_aqui
```

## 🎯 Resultado Esperado

- ✅ 6 tabelas criadas
- ✅ 5 funções implementadas
- ✅ 4 planos inseridos
- ✅ RLS configurado
- ✅ Sistema de auth funcionando

## ⚙️ Limite de instâncias WhatsApp por conta

Para controlar quantas instâncias WhatsApp cada organização pode criar, adicione o campo abaixo em `public.saas_users` no Master:

```sql
alter table public.saas_users
  add column if not exists instance_limits integer not null default 1;
```

Depois, ajuste o limite por cliente conforme necessário:

```sql
update public.saas_users set instance_limits = 2 where organization_id = '<ORG_ID>';
```

O Edge Function `whatsapp-proxy` respeita esse limite ao processar `instance-create`.