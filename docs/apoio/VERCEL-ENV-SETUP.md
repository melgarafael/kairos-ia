# 🚀 CONFIGURAÇÃO VERCEL - Variáveis de Ambiente

## ❌ PROBLEMA ATUAL
O app está dando erro de autenticação porque as variáveis de ambiente do Master Supabase não estão configuradas no Vercel.

## 🔧 SOLUÇÃO - Configure no Vercel Dashboard

### 1. Acesse o Painel do Vercel
1. Vá para: https://vercel.com/dashboard
2. Encontre seu projeto: **tomikcrm**
3. Clique em **Settings**
4. Vá em **Environment Variables** (no menu lateral)

### 2. Adicione as Variáveis do Master Supabase

Clique em **Add** e adicione **TODAS** estas variáveis:

**Variável 1:**
- **Name:** `VITE_MASTER_SUPABASE_URL`
- **Value:** `https://qckjiolragbvvpqvfhrj.supabase.co`
- **Environment:** Production, Preview, Development

**Variável 2:**
- **Name:** `VITE_MASTER_SUPABASE_ANON_KEY`
- **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFja2ppb2xyYWdidnZwcXZmaHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNDU2ODgsImV4cCI6MjA2OTcyMTY4OH0.FKiZn8iDji4Pkyp2aN-WdN47R-xk0ktLrseTQO0iRAI`
- **Environment:** Production, Preview, Development

**Variável 3:**
- **Name:** `VITE_MASTER_SUPABASE_SERVICE_KEY`
- **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFja2ppb2xyYWdidnZwcXZmaHJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDE0NTY4OCwiZXhwIjoyMDY5NzIxNjg4fQ.Ykm-ioDUXHDxOq1GvzZRUUGlfiadwl-xGLUZtXfGkyU`
- **Environment:** Production, Preview, Development

### 3. Redeploy do Site
Após adicionar as variáveis:
1. Vá em **Deployments**
2. Clique em **Redeploy** no último deployment
3. Aguarde o build terminar

## ✅ Verificação
Após o redeploy:
1. Abra o site em produção
2. Pressione **F12** (DevTools)
3. Vá na aba **Console**
4. Deve aparecer:
   ```
   ✅ [MASTER] Master Supabase configured successfully
   🔗 URL: https://qckjiolragbvvpqvfhrj.supabase.co
   🔑 Key configured: true
   ```

## 🎯 Resultado Esperado
- ✅ Signup deve funcionar sem erro "Invalid API key"
- ✅ Usuários criados automaticamente na saas_users
- ✅ Login funcionando normalmente
- ✅ Autenticação SaaS funcionando

---

**IMPORTANTE:** As variáveis DEVEM ter o prefixo `VITE_` para funcionar com Vite!

## 🔒 SEGURANÇA

✅ **CORRETO:** Variáveis no Vercel Dashboard (seguro)
❌ **ERRADO:** Chaves hardcoded no código (inseguro)

As chaves ficam **criptografadas** no Vercel e só são expostas durante o build.

## 🐛 Debug

Se ainda houver problemas:

1. **Verifique o Console:** Procure por erros relacionados ao Master Supabase
2. **Use o Diagnostic Panel:** Acesse `/debug` no app para ver o diagnóstico completo
3. **Verifique as Chaves:** Confirme se as chaves estão corretas no Supabase Dashboard
4. **Teste Local:** Configure as variáveis localmente para testar

## 📋 Checklist

- [ ] VITE_MASTER_SUPABASE_URL configurado
- [ ] VITE_MASTER_SUPABASE_ANON_KEY configurado  
- [ ] VITE_MASTER_SUPABASE_SERVICE_KEY configurado
- [ ] Todas as variáveis marcadas para Production
- [ ] Redeploy realizado
- [ ] Console mostra "Master Supabase configured successfully"
- [ ] Signup funcionando
- [ ] Login funcionando
