# 🚀 Instruções de Deploy - Kairos IA

## ✅ Status Atual

- ✅ Commit realizado com sucesso
- ✅ Arquivos de configuração criados
- ⏳ Aguardando criação do repositório no GitHub
- ⏳ Aguardando push para o GitHub
- ⏳ Aguardando deploy no Vercel

---

## 📝 Passo a Passo Completo

### 1. Criar Repositório no GitHub

1. Acesse: https://github.com/new
2. **Nome do repositório**: `kairos-ia`
3. **Descrição**: `Kairos IA - Admin Panel`
4. Escolha **Público** ou **Privado**
5. **⚠️ IMPORTANTE**: NÃO marque nenhuma opção (README, .gitignore, license)
6. Clique em **Create repository**

### 2. Conectar e Fazer Push

Após criar o repositório, execute no terminal:

```bash
cd /Users/rafaelmelgaco/kairos-ia

# Adicionar o remote (substitua SEU_USUARIO pelo seu username do GitHub)
git remote add kairos https://github.com/SEU_USUARIO/kairos-ia.git

# Fazer push
git push -u kairos main
```

**Exemplo**:
```bash
git remote add kairos https://github.com/rafaelmelgaco/kairos-ia.git
git push -u kairos main
```

### 3. Deploy no Vercel

#### Opção A: Via Dashboard (Recomendado)

1. Acesse: https://vercel.com/new
2. Clique em **Import Git Repository**
3. Selecione o repositório `kairos-ia` que você acabou de criar
4. Configure o projeto:
   - **Framework Preset**: Next.js (deve detectar automaticamente)
   - **Root Directory**: `apps/ia-admin-panel`
   - **Build Command**: `cd ../.. && pnpm install && cd apps/ia-admin-panel && pnpm build`
   - **Output Directory**: `.next`
   - **Install Command**: `pnpm install`
5. Clique em **Deploy**

#### Opção B: Via CLI

```bash
# Instalar Vercel CLI (se ainda não tiver)
npm i -g vercel

# No diretório do projeto
cd /Users/rafaelmelgaco/kairos-ia

# Fazer deploy
vercel

# Seguir as instruções interativas
# Quando perguntar sobre o diretório, digite: apps/ia-admin-panel
```

### 4. Configurar Variáveis de Ambiente

**⚠️ CRÍTICO**: Configure todas as variáveis ANTES de usar o app em produção.

1. No Vercel Dashboard, vá em **Settings** → **Environment Variables**
2. Adicione todas as variáveis listadas no arquivo `VERCEL_ENV_SETUP.md`
3. **IMPORTANTE**: Marque todas para **Production**, **Preview** e **Development**
4. Após adicionar, faça um **Redeploy**

**📄 Documentação completa**: Veja o arquivo `VERCEL_ENV_SETUP.md` para a lista completa de variáveis.

### 5. Atualizar NEXT_PUBLIC_BASE_URL

Após o primeiro deploy:

1. Copie a URL do seu projeto (ex: `https://kairos-ia.vercel.app`)
2. No Vercel, vá em **Settings** → **Environment Variables**
3. Atualize `NEXT_PUBLIC_BASE_URL` com a URL real
4. Faça um **Redeploy**

---

## 🔐 Variáveis de Ambiente Essenciais

### Mínimas para Funcionar

```bash
NEXT_PUBLIC_SUPABASE_URL=https://qckjiolragbvvpqvfhrj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFja2ppb2xyYWdidnZwcXZmaHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNDU2ODgsImV4cCI6MjA2OTcyMTY4OH0.FKiZn8iDji4Pkyp2aN-WdN47R-xk0ktLrseTQO0iRAI
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFja2ppb2xyYWdidnZwcXZmaHJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDE0NTY4OCwiZXhwIjoyMDY5NzIxNjg4fQ.Ykm-ioDUXHDxOq1GvzZRUUGlfiadwl-xGLUZtXfGkyU
OPENAI_API_KEY=your_openai_api_key_here
ADMIN_ANALYTICS_SECRET=0ef5ba44-ff6c-41db-af97-9c67ce8f0471
MCP_SERVICE_ROLE_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFja2ppb2xyYWdidnZwcXZmaHJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDE0NTY4OCwiZXhwIjoyMDY5NzIxNjg4fQ.Ykm-ioDUXHDxOq1GvzZRUUGlfiadwl-xGLUZtXfGkyU
NEXT_PUBLIC_BASE_URL=https://seu-projeto.vercel.app
```

**📋 Lista completa**: Veja `VERCEL_ENV_SETUP.md`

---

## ✅ Checklist Final

- [ ] Repositório criado no GitHub
- [ ] Push realizado com sucesso
- [ ] Projeto importado no Vercel
- [ ] Build configurado corretamente (root: `apps/ia-admin-panel`)
- [ ] Todas as variáveis de ambiente configuradas
- [ ] `NEXT_PUBLIC_BASE_URL` atualizada com a URL real
- [ ] Redeploy realizado
- [ ] Site funcionando sem erros
- [ ] Autenticação testada
- [ ] APIs respondendo corretamente

---

## 🆘 Troubleshooting

### Erro no Build: "Cannot find module"
- Verifique se o **Root Directory** está configurado como `apps/ia-admin-panel`
- Verifique se o **Build Command** está correto

### Erro: "Missing environment variable"
- Verifique se todas as variáveis foram adicionadas no Vercel
- Certifique-se de que estão marcadas para o ambiente correto

### Erro: "Build failed"
- Verifique os logs do build no Vercel
- Certifique-se de que o Node.js está na versão correta (>=20.11.1)
- Verifique se o pnpm está instalado (Vercel detecta automaticamente)

---

## 📚 Documentação Adicional

- **Variáveis de Ambiente**: `VERCEL_ENV_SETUP.md`
- **Configuração Vercel**: `vercel.json`
- **Estrutura do Projeto**: `package.json` (raiz) e `apps/ia-admin-panel/package.json`

---

## 🎉 Pronto!

Após seguir todos os passos, seu projeto estará no ar! 🚀

