# Análise Arquitetural - Code Architect Reviewer

## Módulos Plugáveis ✅

Componentes, hooks e funções que funcionam isoladamente com interfaces bem definidas:

| Arquivo | Tipo | Interface/Props | Descrição |
|---------|------|-----------------|-----------|
| `src/components/ui/Button.tsx` | Componente | `variant`, `size`, `onClick`, `children` | Botão reutilizável com variantes |
| `src/components/ui/Modal.tsx` | Componente | `isOpen`, `onClose`, `title`, `children` | Modal genérico |
| `src/components/ui/Input.tsx` | Componente | `value`, `onChange`, `placeholder`, `type` | Input reutilizável |
| `src/hooks/useDebounce.ts` | Hook | `value`, `delay` → `debouncedValue` | Hook isolado de debounce |
| `src/lib/utils.ts` | Utilitário | Funções puras (`cn`, formatters) | Utilitários sem dependências |
| `src/lib/phone.ts` | Serviço | `normalizePhoneE164BR(phone)` | Normalização de telefone isolada |
| `src/components/layout/Sidebar.tsx` | Componente | `activeTab`, `onTabChange` | Sidebar com props claras |
| `src/components/layout/Header.tsx` | Componente | Sem props (usa context) | Header plugável via context |
| `src/components/features/Auth/SaasLoginForm.tsx` | Componente | Sem props externas | Formulário isolado |
| `src/hooks/useTrailAccess.ts` | Hook | Retorna `hasBySlug`, `hasAccess` | Gate de acesso isolado |

---

## Módulos Acoplados ⚠️

### Tabela de Análise Completa

| Arquivo | Tipo | Problema | Por que é acoplado | Sugestão | Impacto |
|---------|------|----------|-------------------|----------|---------|
| **App.tsx** | Componente | Lógica de roteamento, autenticação, migrações SQL e estado misturados | - Importa 30+ arquivos SQL diretamente<br>- Gerencia navegação por hash (#tab=)<br>- Hardcoded rotas públicas<br>- Lógica de trial/billing inline<br>- Auto-apply migrations no useEffect | **Refatorar para:**<br>1. Criar `AppRouter` separado<br>2. `MigrationService` para migrations<br>3. `RouteManager` para hash navigation<br>4. `TrialGate` component separado<br>5. Extrair `AuthenticatedApp` para arquivo próprio | **Alto** - Arquivo monolítico de 1039 linhas dificulta manutenção e testes |
| **SaasAuthContext.tsx** | Context | Mistura autenticação, billing, setup de Supabase e sessões | - Gerencia auth + billing + setup<br>- Hardcoded Edge Functions URLs<br>- Lógica de criptografia inline<br>- Retry logic misturado com auth | **Separar em:**<br>1. `AuthService` (signIn/signOut)<br>2. `BillingService` (checkout)<br>3. `SupabaseSetupService`<br>4. Context apenas orquestra services | **Alto** - Violação SRP, difícil testar isoladamente |
| **DataContext.tsx** | Context | Acesso direto ao Supabase + lógica de negócio + webhooks | - `supabaseManager.getClientSupabase()` direto<br>- Normalização de dados inline<br>- Trigger de webhooks misturado<br>- Lógica de permission checks | **Refatorar para:**<br>1. `DataService` layer (CRUD abstrato)<br>2. `WebhookService` separado<br>3. `PermissionService` para viewer checks<br>4. Context apenas expõe estado | **Alto** - Dificulta mockar Supabase em testes, acoplamento forte |
| **supabase-manager.ts** | Serviço | Singleton global + lógica de criptografia + validação misturada | - Singleton com estado global<br>- Criptografia Base64 inline<br>- Validação de credenciais misturada<br>- Conexões em Map global | **Refatorar para:**<br>1. `ConnectionManager` (interface)<br>2. `CredentialEncryption` service<br>3. `CredentialValidator` service<br>4. Permitir injeção de dependência | **Médio** - Dificulta testes, acoplamento forte ao browser APIs |
| **Header.tsx** | Componente | Acesso direto ao Master Supabase + lógica de planos hardcoded | - `masterSupabase` import direto<br>- UUIDs de planos hardcoded<br>- Lógica de billing inline | **Criar:**<br>1. `usePlanInfo` hook<br>2. `PlanService` para buscar planos<br>3. Remover imports diretos de Supabase | **Médio** - Viola separação de camadas |
| **Sidebar.tsx** | Componente | Acesso direto ao `useFeatureGate` + lógica de badges inline | - Dependência forte de `useFeatureGate`<br>- Badge messages hardcoded<br>- Gate keys hardcoded no componente | **Refatorar para:**<br>1. `useSidebarItems` hook<br>2. `FeatureGate` component wrapper<br>3. Badge config via props/config | **Baixo** - Funcional mas poderia ser mais flexível |
| **DataContext.tsx** (métodos CRUD) | Funções | Lógica de negócio específica misturada com persistência | - `normalizePhoneE164BR` inline<br>- Cálculo de `payment_value` inline<br>- Normalização de stage inline<br>- Sync de `valor_pago` inline | **Extrair para:**<br>1. `LeadNormalizationService`<br>2. `PaymentCalculationService`<br>3. `StageNormalizationService`<br>4. Manter CRUD genérico | **Médio** - Dificulta reutilização e testes unitários |
| **App.tsx** (migrations) | Lógica | Auto-apply migrations hardcoded no componente | - Array de migrations hardcoded<br>- Lógica de throttling inline<br>- Cache de localStorage inline | **Criar:**<br>1. `MigrationManager` service<br>2. `MigrationRegistry` (config)<br>3. `MigrationCache` service | **Médio** - Deveria ser gerenciado fora do componente |
| **useFeatureGate.ts** | Hook | Acesso direto ao Master Supabase | - `masterSupabase.rpc()` direto<br>- Sem camada de abstração | **Criar:**<br>1. `FeatureService` (abstração)<br>2. Hook apenas consome service | **Baixo** - Funcional mas viola separação |
| **Header.tsx** (plan mapping) | Função | UUIDs de planos hardcoded | - `mapPlanById` com UUIDs literais<br>- Sem config externa | **Mover para:**<br>1. `PlanConfig` (const/JSON)<br>2. Ou buscar do Master Supabase | **Baixo** - Hardcoding dificulta mudanças |
| **SaasAuthContext.tsx** (Edge URLs) | Lógica | Construção de Edge URLs inline | - Lógica de URL transform espalhada<br>- Fallback hardcoded | **Criar:**<br>1. `EdgeUrlResolver` utility<br>2. Centralizar lógica | **Baixo** - Duplicação de código |
| **DataContext.tsx** (realtime) | Lógica | Subscriptions Supabase inline | - Channel setup inline<br>- Sem abstração | **Criar:**<br>1. `RealtimeService` wrapper<br>2. `useRealtime` hook | **Médio** - Dificulta testar subscriptions |
| **JamesPanel.tsx** | Componente | Acesso direto ao `supabaseManager` | - `supabaseManager.getClientSupabase()` direto<br>- Sem camada de serviço | **Criar:**<br>1. `useJamesAgent` hook<br>2. `JamesService` layer | **Baixo** - Funcional mas poderia abstrair |
| **OrganizationSetup.tsx** | Componente | Acesso direto ao Master + lógica complexa | - `masterSupabase` direto<br>- Lógica de criação inline | **Extrair:**<br>1. `OrganizationService`<br>2. Component apenas UI | **Médio** - Lógica complexa misturada com UI |
| **ClientSupabaseSetup.tsx** | Componente | Validação + conexão + SQL guide misturado | - Validação inline<br>- SQL guide inline<br>- Setup logic inline | **Separar:**<br>1. `SupabaseValidator` service<br>2. `SetupWizard` component<br>3. `SqlGuide` component | **Médio** - Componente muito complexo |

---

## Resumo de Impactos

### 🔴 Impacto ALTO (Prioridade 1)
- **App.tsx**: Arquivo monolítico precisa ser dividido em múltiplos módulos
- **SaasAuthContext.tsx**: Violação de SRP, precisa separar responsabilidades
- **DataContext.tsx**: Acoplamento forte ao Supabase, dificulta testes

### 🟡 Impacto MÉDIO (Prioridade 2)
- **supabase-manager.ts**: Singleton global dificulta testes
- **Migrations no App.tsx**: Deveria ser serviço separado
- **CRUD com lógica de negócio**: Precisa extrair serviços de normalização

### 🟢 Impacto BAIXO (Prioridade 3)
- **Hooks com acesso direto**: Funcionam mas violam separação de camadas
- **Hardcoded UUIDs**: Funcional mas dificulta manutenção

---

## Padrões de Acoplamento Identificados

1. **Acesso Direto ao Supabase**: 38+ arquivos importam `masterSupabase` diretamente
2. **Singleton Global**: `supabaseManager` usado em 63+ arquivos sem injeção
3. **Lógica de Negócio em Contexts**: Contexts fazem mais que gerenciar estado
4. **Hardcoding**: UUIDs, URLs, mensagens hardcoded em componentes
5. **Mistura de Responsabilidades**: UI + lógica + persistência no mesmo arquivo

---

## Recomendações Prioritárias

### 1. Criar Camada de Serviços
```
src/services/
  ├── auth/
  │   ├── AuthService.ts
  │   ├── BillingService.ts
  │   └── SupabaseSetupService.ts
  ├── data/
  │   ├── DataService.ts
  │   ├── LeadService.ts
  │   └── PatientService.ts
  └── features/
      ├── FeatureService.ts
      └── PlanService.ts
```

### 2. Abstrair Acesso ao Supabase
```typescript
// Em vez de:
const client = supabaseManager.getClientSupabase()

// Usar:
const client = useSupabaseClient() // Hook que injeta dependência
```

### 3. Separar Lógica de Negócio
```typescript
// Em vez de lógica inline:
if (payload.stage) {
  const normalized = await normalizeStage(payload.stage)
}

// Usar:
const normalized = await stageNormalizationService.normalize(payload.stage)
```

### 4. Configuração Externa
```typescript
// Em vez de:
const planId = 'd4836a79-186f-4905-bfac-77ec52fa1dde'

// Usar:
const planId = config.plans.professional.id
```

---

## Métricas de Acoplamento

- **Arquivos com acesso direto ao Master Supabase**: 38
- **Arquivos usando supabaseManager diretamente**: 63
- **Componentes com lógica de negócio inline**: ~25
- **Hardcoded UUIDs/Strings**: ~15 locais
- **Contexts violando SRP**: 3 (SaasAuth, Data, Notification)

---

**Data da Análise**: 2025-01-27
**Arquitetura Atual**: Monolítica com acoplamento forte
**Recomendação**: Refatoração incremental para arquitetura em camadas

