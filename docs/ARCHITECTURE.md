# Arquitetura — TomikCRM

> **📚 Documentação Completa:** [architecture/](./architecture/)

---

## 🎯 Visão Geral

O TomikCRM é uma aplicação SaaS multi-tenant construída em **React + TypeScript** com arquitetura baseada em três camadas:

1. **Camada de Contexto** - State management global (React Context API)
2. **Camada de Serviços** - Business logic e integrações externas
3. **Camada de Apresentação** - Components React e hooks customizados

---

## 📖 Documentação Detalhada

### 📊 Análise Arquitetural

- **[Arquitetura Atual](./architecture/current-architecture.md)** - Análise completa das camadas, dependências e pontos críticos
- **[Fluxos de Dados](./architecture/data-flows.md)** - Diagramas de sequência dos principais fluxos
- **[Roadmap de Refatoração](./architecture/refactoring-roadmap.md)** - Plano incremental de melhorias
- **[Quick Reference](./architecture/README.md)** - Guia rápido para navegação

---

## 🏗️ Diagrama de Infraestrutura

```mermaid
flowchart TB
  subgraph Browser[Front-end (React)]
    App[App.tsx<br/>1039 linhas]
    SaasAuth[SaasAuthContext<br/>1278 linhas]
    DataCtx[DataContext<br/>1389 linhas]
    Manager[supabaseManager<br/>800 linhas]
  end

  subgraph Master[Master Supabase]
    saas_users[saas_users<br/>Auth + Profile]
    saas_orgs[saas_organizations<br/>Multi-tenant]
    saas_plans[saas_plans<br/>Billing]
    saas_users --> saas_orgs
    saas_orgs --> saas_plans
    saas_users -. guarda .-> creds[(Client Supabase<br/>URL + Key)]
  end

  subgraph Client[Client Supabase]
    crm[CRM: crm_leads, crm_stages]
    agenda[Agenda: appointments]
    dir[Diretórios: clients, collaborators]
    fin[Financeiro: entradas, saidas, produtos_servicos]
  end

  subgraph Edge[Edge Functions]
    chat[assistant-chat/stream]
    stripe[create-checkout-session<br/>stripe-webhook]
    migrations[client-schema-updater]
  end

  App --> SaasAuth
  App --> DataCtx
  SaasAuth --> Manager
  DataCtx --> Manager
  Manager --> Master
  Manager --> Client
  App --> Edge
  Edge --> Master
  Edge --> Client
  
  style App fill:#ff9999
  style SaasAuth fill:#ff9999
  style DataCtx fill:#ff9999
  style Manager fill:#ffcc99
```

**Legenda:**
- 🔴 Vermelho: Componentes críticos com alto acoplamento
- 🟠 Laranja: Componentes que necessitam refatoração

---

## 🔑 Conceitos Principais

### Multi-Tenancy

O sistema é **multi-tenant** usando:
- **Master Supabase** - Auth, billing, gestão de organizações
- **Client Supabase** - Dados isolados por `organization_id` (RLS policies)

Cada organização tem suas próprias credenciais do Client Supabase, armazenadas de forma criptografada no Master.

### Autenticação

1. User faz login no **Master Supabase**
2. Sistema carrega credenciais do **Client Supabase** (URL + Key)
3. `supabaseManager` conecta dinamicamente ao Client do usuário
4. RLS policies isolam dados por `organization_id`

### State Management

**Context API** com 3 contextos principais:
- `SaasAuthContext` - Autenticação SaaS (Master)
- `DataContext` - CRUD de todas as entidades (Client) ⚠️ Monolítico
- `NotificationContext` - Notificações em tempo real

---

## 🔴 Problemas Arquiteturais Identificados

### 1. App.tsx - God Object (1039 linhas)

**Responsabilidades:**
- Roteamento manual (hash-based)
- Trial expired gate
- Auto-apply de 38 migrações SQL
- Navegação por tabs
- Billing logic inline

**Impacto:** Impossível testar, hot reload lento, conflitos de merge

### 2. DataContext.tsx - Contexto Monolítico (1389 linhas)

**Problema:** Gerencia 7 entidades diferentes em um único contexto

**Impacto:**
- Re-renders desnecessários (atualizar lead → re-render de patients)
- Performance ruim com grandes volumes
- Lógica de negócio misturada com estado

### 3. SaasAuthContext.tsx - Múltiplas Responsabilidades (1278 linhas)

**Problema:** Mistura autenticação + billing + gestão de conexões

**Impacto:** Dificulta manutenção e testes

### 4. supabase-manager.ts - Singleton Anti-Pattern (800 linhas)

**Problema:** Singleton global com 11 estratégias de fallback

**Impacto:** Impossível mockar para testes, estado global mutável

---

## ✅ Pontos Fortes

1. **Componentes UI puros** (`components/ui/`) - Reutilizáveis e testáveis
2. **Hooks simples** (`useDebounce`, `useMouseTracking`) - Single responsibility
3. **automation-client** - Interface clara e bem documentada
4. **Realtime subscriptions** - Multi-user collaboration funcionando bem
5. **Optimistic updates** - UX responsivo no Kanban

---

## 🚀 Próximos Passos

Veja o [Roadmap de Refatoração](./architecture/refactoring-roadmap.md) detalhado.

**Fase 1 (2-3 sprints):**
1. Setup de testes (Vitest)
2. Extrair AppRouter de App.tsx
3. Extrair MigrationService

**Fase 2 (3-4 sprints):**
1. Criar LeadsProvider isolado
2. Criar PatientsProvider isolado
3. Refatorar DataContext para orquestrador

---

## 📊 Métricas de Qualidade

| Métrica | Atual | Target |
|---------|-------|--------|
| Maintainability Index (App.tsx) | 25/100 🔴 | 75/100 🟢 |
| Test Coverage | 0% 🔴 | 70% 🟢 |
| Re-renders/min | ~1000 🔴 | ~100 🟢 |
| LOC em arquivos críticos | 3706 🔴 | < 1000 🟢 |

---

## 🔗 Links Úteis

### Documentação Interna
- [Arquitetura Atual](./architecture/current-architecture.md)
- [Fluxos de Dados](./architecture/data-flows.md)
- [Roadmap de Refatoração](./architecture/refactoring-roadmap.md)
- [Quick Reference](./architecture/README.md)

### Outros Docs
- [Setup Master-Client Supabase](./MASTER-CLIENT-SUPABASE.md)
- [Automação (n8n)](./AUTOMATION-TOOLKIT.md)
- [Integração WhatsApp](./WHATSAPP-WEBHOOK-ARCHITECTURE.md)
- [Security](./SECURITY.md)

---

## 🆘 Dúvidas?

Consulte a [Quick Reference](./architecture/README.md) ou abra uma issue no repositório.

---

**Última atualização:** 31 de Outubro de 2025  
**Mantido por:** Engineering Team
