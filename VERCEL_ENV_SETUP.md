# 🚀 Configuração de Variáveis de Ambiente no Vercel

Este documento lista **TODAS** as variáveis de ambiente necessárias para o projeto Kairos IA no Vercel.

## 📍 Onde Configurar

1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto **kairos-ia** (ou crie um novo)
3. Vá em **Settings** → **Environment Variables**
4. Adicione cada variável abaixo para os ambientes: **Production**, **Preview** e **Development**

---

## 🔐 Variáveis Obrigatórias (Core)

### Supabase - Configuração Principal

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

**Onde obter**: No dashboard do Supabase → Settings → API

### OpenAI - API Key

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

**⚠️ IMPORTANTE**: 
- Obtenha sua chave em: https://platform.openai.com/api-keys
- Use o modelo `gpt-5.1` conforme especificado nas regras do projeto

**⚠️ IMPORTANTE**: Use o modelo `gpt-5.1` conforme especificado nas regras do projeto.

### Admin Analytics

```bash
ADMIN_ANALYTICS_SECRET=your_admin_analytics_secret_here
MCP_SERVICE_ROLE_JWT=your_mcp_service_role_jwt_here
```

**Nota**: Use o mesmo valor do `SUPABASE_SERVICE_ROLE_KEY` para `MCP_SERVICE_ROLE_JWT`

### Base URL

```bash
NEXT_PUBLIC_BASE_URL=https://seu-projeto.vercel.app
```

**⚠️ ATENÇÃO**: Substitua `seu-projeto.vercel.app` pela URL real do seu projeto no Vercel após o deploy.

---

## 🎛️ Feature Flags

### IA Console V3 (Habilitado)

```bash
FEATURE_IA_CONSOLE_V3=true
NEXT_PUBLIC_FEATURE_IA_CONSOLE_V3=true
```

### IA Console V2 (Desabilitado - Deprecated)

```bash
FEATURE_IA_CONSOLE_V2=false
NEXT_PUBLIC_FEATURE_IA_CONSOLE_V2=false
IA_CONSOLE_V2_RATE_LIMIT=5
```

### IA Console Vendas (Habilitado)

```bash
FEATURE_IA_CONSOLE_VENDAS=true
NEXT_PUBLIC_FEATURE_IA_CONSOLE_VENDAS=true
```

### IA Console Memberkit (Habilitado)

```bash
FEATURE_IA_CONSOLE_MEMBERKIT=true
NEXT_PUBLIC_FEATURE_IA_CONSOLE_MEMBERKIT=true
```

---

## 🔗 Integrações Opcionais

### Redis/Cache (Opcional - para performance)

```bash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
LANGCACHE_SERVER_URL=https://aws-us-east-1.langcache.redis.io
LANGCACHE_CACHE_ID=
LANGCACHE_API_KEY=
```

**Nota**: Deixe vazio se não estiver usando cache.

### Ticto - Gateway de Vendas

```bash
TICTO_CLIENT_ID=your_ticto_client_id
TICTO_CLIENT_SECRET=your_ticto_client_secret
TICTO_API_BASE_URL=https://glados.ticto.cloud
```

**Onde obter**: https://dashboard.ticto.io

### Hotmart - Plataforma de Produtos Digitais

```bash
HOTMART_CLIENT_ID=be8448c7-c7aa-4b03-9b62-5e23c6ed2d17
HOTMART_CLIENT_SECRET=a1a4a6f5-9927-49cb-ae0e-e6e98bf1ecd4
HOTMART_API_BASE_URL=https://developers.hotmart.com
```

**Onde obter**: https://developers.hotmart.com

**Nota**: Você pode usar `HOTMART_BASIC_AUTH` em vez de Client ID/Secret se preferir.

### Memberkit - Acessos

```bash
MEMBERKIT_API_KEY=your_memberkit_api_key
MEMBERKIT_API_BASE_URL=https://memberkit.com.br/api/v1
```

**Onde obter**: https://memberkit.com.br → Configurações → API

### PostHog Analytics (Opcional)

```bash
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
```

**Nota**: Deixe vazio se não estiver usando PostHog.

---

## 📋 Checklist de Configuração

- [ ] Variáveis do Supabase configuradas
- [ ] `OPENAI_API_KEY` configurada
- [ ] `ADMIN_ANALYTICS_SECRET` configurada
- [ ] `MCP_SERVICE_ROLE_JWT` configurada
- [ ] `NEXT_PUBLIC_BASE_URL` configurada com a URL do Vercel
- [ ] Feature flags configuradas
- [ ] Integrações opcionais configuradas (se necessário)
- [ ] Todas as variáveis marcadas para Production, Preview e Development
- [ ] Redeploy realizado após adicionar variáveis

---

## 🔄 Após Configurar

1. Vá em **Deployments**
2. Clique nos **3 pontos** no último deployment
3. Selecione **Redeploy**
4. Aguarde o build terminar

---

## ✅ Verificação

Após o redeploy, verifique:

1. O site carrega sem erros
2. A autenticação funciona
3. As APIs respondem corretamente
4. Não há erros no console do navegador (F12)

---

## 🆘 Troubleshooting

### Erro: "Missing NEXT_PUBLIC_SUPABASE_URL"
- Verifique se a variável está configurada no Vercel
- Certifique-se de que está marcada para o ambiente correto (Production/Preview/Development)

### Erro: "Invalid API key"
- Verifique se `OPENAI_API_KEY` está correta
- Certifique-se de que não há espaços extras no início/fim

### Erro: "Unauthorized" ou "403 Forbidden"
- Verifique `SUPABASE_SERVICE_ROLE_KEY` e `MCP_SERVICE_ROLE_JWT`
- Certifique-se de que `ADMIN_ANALYTICS_SECRET` está configurada

---

## 📝 Notas Importantes

1. **Nunca commite** arquivos `.env` no Git
2. **Sempre use** variáveis de ambiente no Vercel
3. **Atualize** `NEXT_PUBLIC_BASE_URL` após o primeiro deploy
4. **Use** o modelo `gpt-5.1` da OpenAI conforme especificado
5. **Mantenha** as chaves secretas seguras e não as compartilhe

