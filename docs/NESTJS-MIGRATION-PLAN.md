# Plano de Migração para NestJS

## 📋 Sumário Executivo

Este documento detalha a estratégia de migração do backend atual (Supabase Edge Functions + Go) para NestJS, incluindo análise de complexidade, priorização e roadmap.

> **📌 Plano Detalhado de Implementação**: Para migração dos módulos **Assistant/IA** e **Migrations**, consulte o documento específico: [`NESTJS-MIGRATION-ASSISTANT-MIGRATIONS.md`](./NESTJS-MIGRATION-ASSISTANT-MIGRATIONS.md)

---

## 🔍 Estado Atual do Backend

### Arquitetura Atual

1. **Supabase Edge Functions** (53 funções TypeScript/Deno)
   - Runtime: Deno
   - Deploy: Supabase Edge Functions (serverless)
   - Dependências: Importações via ESM (`https://esm.sh/...`)
   - Banco: PostgreSQL via Supabase Client

2. **Serviço WhatsApp** (Go 1.23)
   - Runtime: Go
   - Deploy: Docker/Container
   - Banco: PostgreSQL direto
   - API: REST via Gorilla Mux

3. **Frontend**
   - React + TypeScript
   - Chama Edge Functions diretamente via fetch
   - Gerencia conexões Master/Client Supabase

---

## 🎯 O Que Seria Necessário para Migrar

### 1. Infraestrutura Base NestJS

#### Setup Inicial
```bash
# Criar novo projeto NestJS
nest new tomikcrm-backend
cd tomikcrm-backend

# Dependências principais
npm install @nestjs/common @nestjs/core @nestjs/platform-express
npm install @supabase/supabase-js
npm install @nestjs/config
npm install @nestjs/swagger
npm install class-validator class-transformer
npm install @nestjs/throttler
npm install @nestjs/schedule
```

#### Estrutura de Pastas Proposta
```
tomikcrm-backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   └── interceptors/
│   ├── config/
│   │   └── database.config.ts
│   ├── modules/
│   │   ├── auth/
│   │   ├── assistant/
│   │   ├── billing/
│   │   ├── whatsapp/
│   │   ├── crm/
│   │   ├── migrations/
│   │   └── webhooks/
│   └── shared/
│       ├── services/
│       └── utils/
├── test/
└── docker/
```

### 2. Módulos NestJS por Categoria

#### **Módulo: Auth** (Prioridade: ALTA)
- Migrar: `auth-magic-link`, `auth-signup`, `auth-recovery`, `password-setup`
- Dependências: Supabase Auth SDK
- Complexidade: MÉDIA (já usa Supabase Auth)

#### **Módulo: Assistant/IA** (Prioridade: ALTA)
- Migrar: `assistant-chat`, `assistant-chat-stream`, `assistant-chat-tools`, `assistant-transcribe`, `assistant-prepare-attachments`
- Dependências: OpenAI SDK, LangChain
- Complexidade: ALTA (streaming, multi-agentes)

#### **Módulo: Billing** (Prioridade: ALTA)
- Migrar: `create-checkout-session`, `stripe-webhook`, `pagarme-webhook`, `hotmart-webhook`, `ticto-webhook`, `provision-subscription`
- Dependências: Stripe SDK, outros gateways
- Complexidade: MÉDIA (webhooks precisam validação)

#### **Módulo: WhatsApp** (Prioridade: MÉDIA)
- Migrar: `whatsapp-orchestrator`, `whatsapp-webhook`, `ingest-whatsapp-message`, `list-whatsapp-messages`
- Integração: Manter serviço Go ou migrar para NestJS
- Complexidade: ALTA (integração com WuzAPI)

#### **Módulo: Migrations** (Prioridade: MÉDIA)
- Migrar: `client-schema-updater`, `client-schema-updater-proxy`, `check-and-apply-migrations`
- Dependências: pg (PostgreSQL driver nativo)
- Complexidade: MÉDIA (execução SQL dinâmica)

#### **Módulo: RAG** (Prioridade: BAIXA)
- Migrar: `rag-upload-url`, `rag-ingest`, `rag-search`, `rag-embed-worker`
- Dependências: OpenAI Embeddings, vector DB
- Complexidade: MÉDIA

#### **Módulo: Webhooks/Automação** (Prioridade: MÉDIA)
- Migrar: `n8n-proxy`, `n8n-create-workflow`, `automation-trigger`, `webhook-processor`
- Complexidade: MÉDIA

#### **Módulo: Admin** (Prioridade: BAIXA)
- Migrar: `admin-analytics`, `admin-users`
- Complexidade: BAIXA

### 3. Desafios Técnicos

#### A. Runtime Deno → Node.js
- **Problema**: Edge Functions usam imports ESM remotos (`https://esm.sh/...`)
- **Solução**: Instalar pacotes npm equivalentes
- **Impacto**: Baixo (maioria tem equivalente npm)

#### B. Deploy Serverless → Servidor
- **Problema**: Edge Functions são serverless, NestJS precisa de servidor
- **Opções**:
  1. **Railway/Render/Fly.io** (servidor tradicional)
  2. **AWS Lambda + Serverless Framework** (serverless NestJS)
  3. **Google Cloud Run** (containers serverless)
  4. **Vercel** (com adaptador NestJS)
- **Recomendação**: Railway ou Render para simplicidade inicial

#### C. Conexões Supabase
- **Problema**: Frontend chama Edge Functions diretamente
- **Solução**: 
  - Criar API Gateway NestJS
  - Manter compatibilidade de rotas durante migração
  - Usar proxy reverso para migração gradual

#### D. Autenticação
- **Problema**: Edge Functions usam `Deno.env.get()` e headers Supabase
- **Solução**: 
  - Usar `@nestjs/config` para env vars
  - Criar guard customizado para validar Supabase tokens
  - Manter integração com Supabase Auth

#### E. Streaming (assistant-chat-stream)
- **Problema**: Edge Functions retornam `Response` com stream
- **Solução**: Usar `@nestjs/common` StreamableFile ou SSE (Server-Sent Events)

---

## 📊 Priorização de Migração

### Fase 1: Fundação (Semanas 1-2)
**Objetivo**: Setup básico e migrar funções simples

1. ✅ **Setup NestJS base**
   - Projeto inicial
   - Configuração de env vars
   - Conexão Supabase
   - Health check endpoint

2. ✅ **Módulo Auth básico**
   - `auth-signup` (simples, sem dependências complexas)
   - `password-setup`
   - Guards de autenticação

3. ✅ **Módulo Admin**
   - `admin-analytics` (queries simples)
   - `admin-users` (CRUD básico)

**Critério**: Funções sem dependências externas complexas, sem streaming

---

### Fase 2: Core Business (Semanas 3-5)
**Objetivo**: Migrar funcionalidades críticas do negócio

1. ✅ **Módulo Billing**
   - `create-checkout-session` (Stripe)
   - `stripe-webhook` (validação de assinatura)
   - `provision-subscription`
   - Outros webhooks (pagarme, hotmart, ticto)

2. ✅ **Módulo Migrations**
   - `client-schema-updater` (crítico para onboarding)
   - `check-and-apply-migrations`

**Critério**: Funcionalidades que bloqueiam onboarding e billing

---

### Fase 3: Features Avançadas (Semanas 6-8)
**Objetivo**: Migrar funcionalidades complexas

1. ✅ **Módulo Assistant**
   - `assistant-chat` (sem streaming primeiro)
   - `assistant-chat-stream` (SSE)
   - `assistant-chat-tools`
   - `assistant-transcribe`
   - `assistant-prepare-attachments`

2. ✅ **Módulo WhatsApp**
   - `whatsapp-webhook`
   - `ingest-whatsapp-message`
   - `list-whatsapp-messages`
   - Decisão: Migrar serviço Go ou manter?

**Critério**: Features que requerem mais testes e ajustes

---

### Fase 4: Automação e RAG (Semanas 9-10)
**Objetivo**: Completar migração

1. ✅ **Módulo RAG**
   - `rag-upload-url`
   - `rag-ingest`
   - `rag-search`

2. ✅ **Módulo Automação**
   - `n8n-proxy`
   - `automation-trigger`
   - `webhook-processor`

3. ✅ **Limpeza**
   - Remover Edge Functions antigas
   - Atualizar frontend para usar nova API
   - Documentação

---

## 🛠️ Estratégia de Migração Gradual

### Abordagem: Strangler Fig Pattern

```
┌─────────────────────────────────────────┐
│         Frontend (React)                │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
   ┌───▼────┐      ┌───▼──────────┐
   │ NestJS │      │ Edge Functions│
   │  (Novo)│      │   (Legado)    │
   └───┬────┘      └───┬───────────┘
       │                │
       └───────┬────────┘
               │
       ┌───────▼───────┐
       │   Supabase    │
       │  PostgreSQL   │
       └───────────────┘
```

### Passos:

1. **Proxy Reverso**: Criar rota NestJS que proxy para Edge Functions antigas
2. **Migrar uma função por vez**: Substituir proxy por implementação NestJS
3. **Feature Flags**: Usar flags para alternar entre novo/antigo
4. **Testes paralelos**: Rodar ambos em produção, comparar resultados
5. **Desligar Edge Function**: Após validação, remover proxy

### Exemplo de Proxy Temporário:

```typescript
// app.controller.ts
@Controller('api')
export class AppController {
  @Post('assistant-chat')
  async assistantChat(@Req() req: Request, @Body() body: any) {
    // Feature flag: usar novo ou antigo
    if (process.env.USE_NESTJS_ASSISTANT === 'true') {
      return this.assistantService.chat(body);
    }
    
    // Proxy para Edge Function antiga
    const edgeFunctionUrl = `${process.env.SUPABASE_EDGE_URL}/assistant-chat`;
    return fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify(body),
    });
  }
}
```

---

## 📦 Dependências Necessárias

### Core NestJS
```json
{
  "@nestjs/common": "^10.0.0",
  "@nestjs/core": "^10.0.0",
  "@nestjs/platform-express": "^10.0.0",
  "@nestjs/config": "^3.0.0",
  "@nestjs/swagger": "^7.0.0",
  "@nestjs/throttler": "^5.0.0",
  "@nestjs/schedule": "^4.0.0"
}
```

### Database & Supabase
```json
{
  "@supabase/supabase-js": "^2.53.0",
  "pg": "^8.11.0",
  "@types/pg": "^8.10.0"
}
```

### Billing
```json
{
  "stripe": "^14.24.0",
  "@stripe/stripe-js": "^2.0.0"
}
```

### IA & OpenAI
```json
{
  "openai": "^4.0.0",
  "@langchain/core": "^0.3.72",
  "@langchain/openai": "^0.6.9"
}
```

### Validação & Utils
```json
{
  "class-validator": "^0.14.0",
  "class-transformer": "^0.5.1",
  "zod": "^4.0.13",
  "@nestjs/zod": "^0.3.0"
}
```

### HTTP & Streaming
```json
{
  "axios": "^1.6.0",
  "node-fetch": "^3.3.2"
}
```

---

## 🚀 Plano de Ação Detalhado

### Semana 1: Setup Inicial

**Dia 1-2: Projeto Base**
- [ ] Criar projeto NestJS
- [ ] Configurar estrutura de pastas
- [ ] Setup de env vars (`@nestjs/config`)
- [ ] Conexão com Supabase (Master + Client)
- [ ] Health check endpoint
- [ ] Dockerfile básico

**Dia 3-4: Módulo Auth**
- [ ] Criar `AuthModule`
- [ ] Migrar `auth-signup`
- [ ] Migrar `password-setup`
- [ ] Criar guards de autenticação
- [ ] Testes unitários básicos

**Dia 5: Deploy**
- [ ] Setup Railway/Render
- [ ] Deploy de teste
- [ ] Configurar CI/CD básico

---

### Semana 2: Admin & Utils

**Dia 1-2: Módulo Admin**
- [ ] Criar `AdminModule`
- [ ] Migrar `admin-analytics`
- [ ] Migrar `admin-users`
- [ ] Endpoints de admin protegidos

**Dia 3-4: Utils & Common**
- [ ] Criar módulo `CommonModule`
- [ ] Decorators customizados
- [ ] Exception filters
- [ ] Interceptors (logging, transform)
- [ ] CORS config

**Dia 5: Testes & Docs**
- [ ] Testes de integração
- [ ] Swagger/OpenAPI docs
- [ ] Documentação de API

---

### Semana 3-4: Billing (Crítico)

**Semana 3: Stripe**
- [ ] Criar `BillingModule`
- [ ] Migrar `create-checkout-session`
- [ ] Migrar `stripe-webhook` (validação de assinatura)
- [ ] Migrar `provision-subscription`
- [ ] Testes com Stripe test mode

**Semana 4: Outros Gateways**
- [ ] Migrar `pagarme-webhook`
- [ ] Migrar `hotmart-webhook`
- [ ] Migrar `ticto-webhook`
- [ ] Testes end-to-end de billing

---

### Semana 5: Migrations

- [ ] Criar `MigrationsModule`
- [ ] Migrar `client-schema-updater`
- [ ] Migrar `check-and-apply-migrations`
- [ ] Testes com migrations reais
- [ ] Rollback strategy

---

### Semana 6-7: Assistant (Complexo)

**Semana 6: Chat Básico**
- [ ] Criar `AssistantModule`
- [ ] Migrar `assistant-chat` (sem streaming)
- [ ] Migrar `assistant-chat-tools`
- [ ] Integração OpenAI

**Semana 7: Streaming & Attachments**
- [ ] Migrar `assistant-chat-stream` (SSE)
- [ ] Migrar `assistant-transcribe`
- [ ] Migrar `assistant-prepare-attachments`
- [ ] Testes de streaming

---

### Semana 8: WhatsApp

- [ ] Criar `WhatsAppModule`
- [ ] Decisão: Migrar serviço Go ou manter?
- [ ] Migrar `whatsapp-webhook`
- [ ] Migrar `ingest-whatsapp-message`
- [ ] Migrar `list-whatsapp-messages`
- [ ] Integração com WuzAPI

---

### Semana 9-10: RAG & Automação

**Semana 9: RAG**
- [ ] Criar `RagModule`
- [ ] Migrar `rag-upload-url`
- [ ] Migrar `rag-ingest`
- [ ] Migrar `rag-search`

**Semana 10: Automação**
- [ ] Criar `AutomationModule`
- [ ] Migrar `n8n-proxy`
- [ ] Migrar `automation-trigger`
- [ ] Migrar `webhook-processor`

---

### Semana 11: Finalização

- [ ] Migrar funções restantes
- [ ] Atualizar frontend para usar nova API
- [ ] Remover Edge Functions antigas
- [ ] Documentação completa
- [ ] Performance testing
- [ ] Load testing

---

## ⚠️ Riscos e Mitigações

### Risco 1: Downtime durante migração
**Mitigação**: 
- Migração gradual (Strangler Fig)
- Feature flags para rollback rápido
- Manter Edge Functions até validação completa

### Risco 2: Diferenças de comportamento
**Mitigação**:
- Testes de comparação (novo vs antigo)
- Logs detalhados
- Monitoramento de erros

### Risco 3: Performance pior que Edge Functions
**Mitigação**:
- Benchmark antes/depois
- Otimização de queries
- Cache quando apropriado
- CDN para assets estáticos

### Risco 4: Custo maior (servidor vs serverless)
**Mitigação**:
- Comparar custos Railway/Render vs Supabase Edge
- Considerar serverless NestJS (AWS Lambda)
- Monitorar uso de recursos

---

## 💰 Estimativa de Custos

### Atual (Supabase Edge Functions)
- Supabase Edge: ~$25/mês (incluído no plano Pro)
- Serviço Go (WhatsApp): ~$10-20/mês (VPS)

### NestJS (Estimativa)
- **Opção 1: Railway/Render**
  - Starter: $5-10/mês
  - Pro: $20-50/mês (dependendo de tráfego)
  
- **Opção 2: AWS Lambda + API Gateway**
  - Serverless: ~$10-30/mês (pay-per-use)
  
- **Opção 3: Google Cloud Run**
  - Serverless: ~$10-25/mês

**Conclusão**: Custo similar ou ligeiramente maior, mas com mais controle.

---

## ✅ Checklist de Migração

### Pré-Migração
- [ ] Backup completo do banco de dados
- [ ] Documentar todas as Edge Functions
- [ ] Mapear dependências entre funções
- [ ] Identificar funções críticas
- [ ] Setup de ambiente de staging

### Durante Migração
- [ ] Migrar uma função por vez
- [ ] Testes unitários para cada função
- [ ] Testes de integração
- [ ] Comparar resultados novo vs antigo
- [ ] Monitorar logs e erros
- [ ] Feature flags para rollback

### Pós-Migração
- [ ] Remover Edge Functions antigas
- [ ] Atualizar documentação
- [ ] Treinar equipe
- [ ] Monitorar performance
- [ ] Otimizar queries lentas

---

## 📚 Recursos Úteis

### Documentação
- [NestJS Docs](https://docs.nestjs.com/)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript/introduction)
- [Stripe Node SDK](https://stripe.com/docs/api/node)

### Tutoriais
- [NestJS + Supabase](https://supabase.com/docs/guides/getting-started/tutorials/with-nestjs)
- [NestJS Serverless](https://docs.nestjs.com/faq/serverless)

### Ferramentas
- [NestJS CLI](https://docs.nestjs.com/cli/overview)
- [Swagger/OpenAPI](https://docs.nestjs.com/openapi/introduction)

---

## 🎯 Conclusão

A migração para NestJS é **viável e recomendada** se você busca:
- ✅ Melhor estruturação de código
- ✅ Facilidade de testes
- ✅ Type-safety melhor
- ✅ Escalabilidade
- ✅ Manutenibilidade

**Tempo estimado**: 10-12 semanas (com 1 desenvolvedor full-time)

**Complexidade**: Média-Alta (principalmente por causa do volume de funções)

**Recomendação**: Começar pela **Fase 1** (fundação) e validar antes de continuar.

