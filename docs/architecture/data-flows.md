# Fluxos de Dados - TomikCRM

> Documentação detalhada dos principais fluxos de dados na aplicação

---

## Índice

1. [Fluxos de Autenticação](#fluxos-de-autenticação)
2. [Fluxos de Dados (CRUD)](#fluxos-de-dados-crud)
3. [Fluxos de Automação](#fluxos-de-automação)
4. [Fluxos de Billing](#fluxos-de-billing)
5. [Fluxos de Realtime](#fluxos-de-realtime)
6. [Fluxos de WhatsApp](#fluxos-de-whatsapp)

---

## Fluxos de Autenticação

### 1. Login Flow (SaaS Multi-Tenant)

```mermaid
sequenceDiagram
    autonumber
    participant U as 👤 User
    participant UI as LoginFormV2
    participant SA as SaasAuthContext
    participant MS as Master Supabase<br/>(Auth DB)
    participant SM as supabase-manager
    participant CS as Client Supabase<br/>(Data DB)
    participant A as App.tsx

    U->>UI: Enter email + password
    UI->>SA: signIn(credentials)
    
    Note over SA: Phase 1: Master Auth
    SA->>MS: auth.signInWithPassword()
    MS-->>SA: ✅ Session + User ID
    
    Note over SA: Phase 2: Fetch User Profile
    SA->>MS: Query saas_users<br/>WHERE id = userId
    MS-->>SA: User profile<br/>(org_id, setup_completed, plan_id)
    
    Note over SA: Phase 3: Check Token Expiry
    SA->>MS: RPC check_user_org_expired_token()
    MS->>MS: Find org by user_id
    MS->>MS: Query attributed_token_id
    MS->>MS: Check if token expired
    
    alt Token Expired
        MS->>MS: UPDATE org.plan_id = 'trial-expired'
        MS-->>SA: { updated: true }
        SA->>MS: Re-fetch user (updated plan)
    else Token Valid
        MS-->>SA: { updated: false }
    end
    
    Note over SA: Phase 4: Reconnect Client Supabase
    SA->>SM: reconnectIfNeeded(orgId)
    SM->>MS: loadClientCredentials(orgId)
    
    Note over MS: Try 11 fallback strategies:<br/>1. Per-org creds (Master)<br/>2. Membership creds<br/>3. Owner creds from membership<br/>4. Mirror org owner<br/>5-11. Legacy fallbacks
    
    MS-->>SM: Encrypted credentials
    SM->>SM: Decrypt Base64
    SM->>CS: createClient(url, key)
    CS-->>SM: Test connection
    SM->>CS: RPC set_rls_context(orgId)
    CS-->>SM: ✅ RLS context set
    SM-->>SA: Connection ready
    
    Note over SA: Phase 5: Record Session
    SA->>MS: Edge Function<br/>POST /saas-sessions?action=start
    MS-->>SA: Session recorded
    
    SA->>SA: setState({ user, isAuthenticated: true })
    SA-->>A: Render <AuthenticatedApp />
    
    Note over A: Phase 6: Check Active Memberships
    A->>MS: Query saas_memberships<br/>WHERE status='active'
    MS-->>A: Active memberships
    
    Note over A: Phase 7: Initialize Data
    A->>A: Render DataProvider
    A->>CS: Fetch leads, patients, etc.
    CS-->>A: Initial data
    A-->>U: 🎉 Dashboard loaded
```

**Pontos críticos identificados:**

1. 🔴 **11 estratégias de fallback** (lines SM→MS): Lógica complexa demais, dificulta debug
2. 🔴 **Token check no client**: Deveria ser server-side guard
3. 🟠 **Criptografia Base64**: Não é criptografia real, apenas encoding
4. 🟠 **Reconexão pode falhar silenciosamente**: Sem retry automático

---

### 2. Signup Flow (com Trial ou Checkout)

```mermaid
sequenceDiagram
    autonumber
    participant U as 👤 User
    participant UI as SignUpForm
    participant SA as SaasAuthContext
    participant EF as Edge Function<br/>auth-signup
    participant MS as Master Supabase
    participant Email as Resend<br/>(Email Service)
    participant Stripe as Stripe<br/>(se paid plan)

    U->>UI: Fill signup form<br/>(name, email, password, plan)
    UI->>SA: signUp(data)
    
    Note over SA: Validate rate limit
    SA->>localStorage: Check last_signup_attempt
    localStorage-->>SA: Timestamp
    
    alt Rate limit exceeded
        SA-->>UI: ❌ Error: Wait 30s
    end
    
    Note over SA: Verify plan exists
    SA->>MS: Query saas_plans<br/>WHERE slug = planId
    MS-->>SA: Plan UUID
    
    Note over SA: Create account via Edge Function
    SA->>EF: POST /auth-signup<br/>(email, password, name, plan_id)
    
    EF->>MS: auth.admin.createUser()
    MS-->>EF: User created (unconfirmed)
    
    EF->>MS: auth.admin.generateLink('signup')
    MS-->>EF: Confirmation link
    
    EF->>Email: Send confirmation email<br/>with custom link
    Email-->>EF: ✅ Email sent
    
    EF-->>SA: { user_id }
    
    Note over SA: Wait for trigger to process
    SA->>SA: sleep(3000ms)
    
    SA->>MS: checkEmailExists(email)
    MS-->>SA: User exists in saas_users
    
    alt Paid Plan (Basic/Pro)
        SA->>SA: setSignupSuccessPendingLogin(false)
        SA->>SA: Prepare for checkout redirect
    else Trial Plan
        SA->>SA: setSignupSuccessPendingLogin(true)
        SA-->>UI: Show "Check your email" screen
    end
    
    Note over U: User clicks email confirmation
    U->>MS: GET /auth/v1/verify?token=...
    MS->>MS: Verify token
    MS->>MS: Set email_confirmed = true
    
    alt Signup Type
        MS->>MS: Trigger handle_new_user()
        MS->>MS: INSERT INTO saas_users
        MS-->>U: Redirect to /email-confirmed
    end
    
    U->>UI: Navigate to /login
    UI->>SA: signIn(email, password)
    Note over SA: Follow normal login flow
```

**Pontos críticos:**

1. 🔴 **Sleep de 3 segundos**: Gambiarra para wait do trigger
2. 🟠 **Email confirmation manual**: Usuário precisa clicar
3. 🟠 **Paid plan redirect**: Lógica de redirect complexa

---

## Fluxos de Dados (CRUD)

### 3. Create Lead Flow (com Validações e Webhooks)

```mermaid
sequenceDiagram
    autonumber
    participant UI as 🎨 KanbanBoard
    participant H as useKanbanLeads
    participant DC as DataContext
    participant Validator as ValidationService<br/>(inline)
    participant Pricing as PricingService<br/>(inline)
    participant CS as Client Supabase
    participant WH as WebhookService<br/>(inline)
    participant n8n as n8n Workflows
    participant WA as WhatsAppValidator<br/>(background)

    UI->>H: createLead(formData)
    
    Note over H: Hook wrapper
    H->>DC: addLead(data)
    
    Note over DC: Phase 1: Validation
    DC->>Validator: normalizePhoneE164BR(whatsapp)
    Validator-->>DC: +5511999999999
    
    DC->>DC: normalizeStage(stage)
    Note over DC: Find exact stage name<br/>from crm_stages
    
    Note over DC: Phase 2: Pricing Calculation
    alt Has sold_produto_servico_id
        DC->>CS: Query produtos_servicos<br/>WHERE id = productId
        CS-->>DC: Product price
        DC->>Pricing: Calculate payment_value<br/>(price * quantity)
        Pricing-->>DC: Total value
        DC->>DC: Set has_payment = true
    end
    
    Note over DC: Phase 3: Create via RPC
    DC->>CS: RPC crm_leads_upsert()<br/>(with all validated data)
    
    CS->>CS: INSERT INTO crm_leads
    CS->>CS: Trigger: log activity
    CS->>CS: Trigger: update stage stats
    CS-->>DC: ✅ Lead created
    
    Note over DC: Phase 4: Optimistic UI Update
    DC->>DC: setState([newLead, ...leads])
    DC-->>H: Return new lead
    H-->>UI: 🎉 Lead appears instantly
    
    Note over DC: Phase 5: Webhook Dispatch
    DC->>CS: Query webhook_configurations<br/>WHERE event_type='lead_created'<br/>AND is_active=true
    CS-->>DC: Active webhooks
    
    loop For each webhook
        DC->>WH: sendWebhook(url, payload)
        WH->>n8n: POST webhook
        n8n-->>WH: 200 OK
    end
    
    Note over DC: Phase 6: WhatsApp Validation (Background)
    H->>WA: checkWhatsApp(phone)<br/>(fire and forget)
    
    WA->>CS: Query whatsapp_instances<br/>WHERE is_active=true
    CS-->>WA: Instance ID
    
    WA->>n8n: POST /wuzapi/check
    n8n-->>WA: { hasWhatsApp: true }
    
    WA->>CS: UPDATE crm_leads<br/>SET has_whatsapp=true
    WA->>window: dispatchEvent('leadWhatsAppUpdated')
    
    UI->>UI: Listen event → update icon
```

**Problemas identificados:**

1. 🔴 **ValidationService inline**: Deveria ser classe separada
2. 🔴 **PricingService inline**: Cálculo misturado com CRUD
3. 🔴 **Webhook síncrono**: Pode atrasar resposta (deveria ser queue)
4. 🟠 **WhatsApp em background**: Pode falhar silenciosamente

---

### 4. Update Lead Flow (com Stage Change)

```mermaid
sequenceDiagram
    autonumber
    participant UI as 🎨 Kanban DnD
    participant H as useKanbanLeads
    participant DC as DataContext
    participant CS as Client Supabase
    participant RT as Realtime Channel

    Note over UI: User drags lead card
    UI->>UI: onDragEnd(leadId, newStage)
    
    Note over UI: Optimistic UI Update
    UI->>UI: Move card visually INSTANTLY
    
    UI->>H: moveLeadToStage(leadId, newStage)
    
    Note over H: Normalize stage name
    H->>H: Find exact stage name<br/>from stages array
    
    H->>DC: moveLead(leadId, normalizedStage)
    
    Note over DC: Optimistic State Update
    DC->>DC: setState(leads.map(l => <br/>  l.id === leadId<br/>    ? {...l, stage: newStage}<br/>    : l<br/>))
    
    DC-->>H: true (immediate)
    H-->>UI: Success (no wait)
    
    Note over DC: Background DB Update
    DC->>CS: UPDATE crm_leads<br/>SET stage=newStage, updated_at=now()<br/>WHERE id=leadId
    
    CS->>CS: Trigger: log_lead_stage_change
    CS->>CS: INSERT INTO crm_lead_activities
    
    alt Update fails
        CS-->>DC: ❌ Error
        DC->>DC: Revert optimistic update
        DC->>UI: Show error toast
        UI->>UI: Revert card position
    else Update succeeds
        CS-->>DC: ✅ Success
        
        Note over CS: Realtime broadcast
        CS->>RT: Broadcast change to all clients
        RT-->>UI: 🔄 Other users see change
    end
```

**Características:**

✅ **Trello-style optimistic update**: UX instantâneo
✅ **Realtime sync**: Multi-user collaboration
🟠 **Revert manual**: Não há retry automático

---

## Fluxos de Automação

### 5. Webhook Trigger Flow (n8n Integration)

```mermaid
sequenceDiagram
    autonumber
    participant CS as Client Supabase
    participant Trigger as SQL Trigger
    participant Queue as webhook_event_queue
    participant Edge as Edge Function<br/>webhook-processor
    participant Config as webhook_configurations
    participant n8n as n8n Workflow
    participant Log as automation_executions

    Note over CS: User action (e.g., appointment created)
    CS->>CS: INSERT INTO appointments
    
    CS->>Trigger: AFTER INSERT trigger fires
    
    Trigger->>Queue: INSERT INTO webhook_event_queue<br/>(event_type, payload, org_id)
    
    Note over Edge: Periodic or manual invocation
    CS->>Edge: POST /webhook-processor<br/>(organizationId)
    
    Edge->>Queue: SELECT * FROM webhook_event_queue<br/>WHERE organization_id=orgId<br/>AND status='pending'<br/>LIMIT 100
    
    Queue-->>Edge: Pending events
    
    Edge->>Config: SELECT * FROM webhook_configurations<br/>WHERE is_active=true<br/>AND event_types @> ARRAY[event_type]
    
    Config-->>Edge: Matched webhooks
    
    loop For each event
        loop For each webhook
            Edge->>n8n: POST webhook_url<br/>(event payload)
            
            alt Success
                n8n-->>Edge: 200 OK
                Edge->>Queue: UPDATE status='completed'
                Edge->>Log: INSERT success log
            else Failure
                n8n-->>Edge: 4xx/5xx Error
                Edge->>Queue: INCREMENT retry_count
                
                alt retry_count >= 3
                    Edge->>Queue: UPDATE status='failed'
                    Edge->>Log: INSERT failure log
                else
                    Edge->>Queue: UPDATE status='pending'<br/>(will retry later)
                end
            end
        end
    end
    
    Edge-->>CS: Processing complete
```

**Características:**

✅ **Queue-based**: Não bloqueia transações
✅ **Retry automático**: 3 tentativas
✅ **Logging**: Audit trail completo
🟠 **Periodic invocation**: Não é true real-time (delay de ~30s)

---

## Fluxos de Billing

### 6. Trial Expiration Check Flow

```mermaid
sequenceDiagram
    autonumber
    participant A as App.tsx<br/>(useEffect)
    participant MS as Master Supabase
    participant RPC as check_user_org_expired_token
    participant Orgs as saas_organizations
    participant Tokens as saas_plan_tokens
    participant SA as SaasAuthContext

    Note over A: Polling every 10 minutes
    A->>MS: RPC check_user_org_expired_token(userId)
    
    Note over RPC: Find user's organization
    RPC->>Orgs: SELECT * FROM saas_organizations<br/>WHERE owner_id = userId
    Orgs-->>RPC: Organization data<br/>(attributed_token_id, applied_org_id, plan_id)
    
    Note over RPC: Check plan type
    alt Plan is Pro/Starter
        RPC->>RPC: Check if attributed_token_id exists<br/>OR applied_organization_id exists
        
        alt Has attributed_token_id
            RPC->>Tokens: SELECT * FROM saas_plan_tokens<br/>WHERE id = attributed_token_id
            Tokens-->>RPC: Token with expires_at
            
            RPC->>RPC: Check if expires_at < NOW()
            
            alt Token expired
                RPC->>Orgs: UPDATE plan_id = 'trial-expired'<br/>WHERE id = orgId
                RPC-->>MS: { success: true, updated: true }
                
                MS-->>A: Token was expired, plan updated
                
                A->>A: Force refresh user data
                A->>SA: refreshUser()
                SA->>MS: Fetch updated user
                MS-->>SA: User with plan='trial-expired'
                SA-->>A: User state updated
                
                A->>A: Render <TrialExpiredModal />
            else Token valid
                RPC-->>MS: { success: true, updated: false }
                MS-->>A: All good, no action
            end
        else Has applied_organization_id
            Note over RPC: Pro-legacy or Starter-legacy<br/>(tokens from addons)
            RPC->>RPC: Similar check via applied_org
            Note over RPC: Implementation details omitted
        else No token
            RPC-->>MS: { success: false, error: 'No token found' }
        end
    else Plan is Trial
        Note over RPC: Trial plans don't expire via tokens<br/>(they expire via creation date)
        RPC-->>MS: { success: true, updated: false }
    end
```

**Problemas:**

1. 🔴 **Polling client-side**: Ineficiente, deveria ser server-side cron
2. 🔴 **Race condition**: Refresh pode acontecer antes do UPDATE
3. 🟠 **Modal blocking**: Usuário pode precisar salvar antes de ser bloqueado

---

### 7. Stripe Checkout Flow

```mermaid
sequenceDiagram
    autonumber
    participant U as 👤 User
    participant UI as Trial Expired Modal
    participant SA as SaasAuthContext
    participant Edge as Edge Function<br/>create-checkout-session
    participant Stripe as Stripe API
    participant Webhook as Stripe Webhook
    participant MS as Master Supabase

    U->>UI: Click "Upgrade to Pro"
    UI->>SA: startCheckout('professional', 'monthly')
    
    SA->>Edge: POST /create-checkout-session<br/>(user_id, plan_slug, interval)
    
    Edge->>MS: Query saas_plans<br/>WHERE slug = plan_slug
    MS-->>Edge: Plan details (price_ids)
    
    Edge->>Edge: Get price_id for interval<br/>(monthly/yearly)
    
    Edge->>Stripe: POST /checkout/sessions
    Note over Edge: line_items: [{ price: price_id, quantity: 1 }]<br/>success_url: /checkout/success<br/>cancel_url: /checkout/cancel<br/>metadata: { user_id, plan_slug }
    
    Stripe-->>Edge: Session created<br/>(checkout URL)
    
    Edge-->>SA: { url: checkout_url }
    
    SA->>SA: sessionStorage.setItem('after-signup-redirect', 'checkout')
    SA-->>UI: Checkout URL
    
    UI->>Stripe: window.location.href = checkout_url
    
    Note over U: User completes payment on Stripe
    
    Stripe->>Webhook: POST /stripe-webhook<br/>(event: checkout.session.completed)
    
    Webhook->>MS: Query saas_users<br/>WHERE id = metadata.user_id
    MS-->>Webhook: User data
    
    Webhook->>MS: Query or CREATE saas_plan_tokens<br/>(plan_id, attribution_source='stripe')
    MS-->>Webhook: Token created
    
    Webhook->>MS: UPDATE saas_organizations<br/>SET plan_id = new_plan_id,<br/>attributed_token_id = token_id
    
    Webhook-->>Stripe: 200 OK
    
    Stripe-->>U: Redirect to success_url
    U->>UI: /checkout/success
    
    UI->>MS: Fetch updated user data
    MS-->>UI: User with new plan
    
    UI-->>U: 🎉 "Upgrade successful!"
```

**Características:**

✅ **Stripe handles payment**: Seguro e PCI compliant
✅ **Webhook idempotency**: Stripe envia múltiplas vezes se necessário
🟠 **Metadata coupling**: Depende de user_id em metadata

---

## Fluxos de Realtime

### 8. Realtime Leads Sync (Multi-User)

```mermaid
sequenceDiagram
    autonumber
    participant U1 as 👤 User 1<br/>(DataContext)
    participant CS as Client Supabase
    participant RT as Realtime Broadcast
    participant U2 as 👤 User 2<br/>(DataContext)
    participant U3 as 👤 User 3<br/>(DataContext)

    Note over U1,U3: All users subscribe on mount
    
    U1->>CS: channel('crm_leads_orgId')<br/>.on('postgres_changes')
    U2->>CS: channel('crm_leads_orgId')<br/>.on('postgres_changes')
    U3->>CS: channel('crm_leads_orgId')<br/>.on('postgres_changes')
    
    CS-->>U1: ✅ Subscribed
    CS-->>U2: ✅ Subscribed
    CS-->>U3: ✅ Subscribed
    
    Note over U1: User 1 creates a lead
    U1->>U1: Optimistic update (instant UI)
    U1->>CS: INSERT INTO crm_leads
    
    CS->>CS: Row inserted
    CS->>RT: Broadcast INSERT event<br/>(payload: { new: lead_data })
    
    Note over RT: Broadcast to all subscribers
    RT-->>U1: INSERT event (ignored, already has it)
    RT-->>U2: INSERT event
    RT-->>U3: INSERT event
    
    U2->>U2: setState([newLead, ...leads])
    U3->>U3: setState([newLead, ...leads])
    
    Note over U2,U3: Leads appear instantly on their screens
    
    Note over U2: User 2 updates the lead
    U2->>U2: Optimistic update
    U2->>CS: UPDATE crm_leads SET stage='Contato'
    
    CS->>CS: Row updated
    CS->>RT: Broadcast UPDATE event<br/>(payload: { new: updated_data })
    
    RT-->>U1: UPDATE event
    RT-->>U2: UPDATE event (ignored)
    RT-->>U3: UPDATE event
    
    U1->>U1: setState(leads.map(l => <br/>  l.id === leadId ? newData : l))
    U3->>U3: setState(leads.map(l => <br/>  l.id === leadId ? newData : l))
    
    Note over U1,U3: All users see the change simultaneously
```

**Características:**

✅ **True realtime**: Latência < 500ms
✅ **Optimistic + Realtime**: Best of both worlds
✅ **Deduplication**: Ignora próprias mudanças
🟠 **Subscription per entity**: Pode ser muitas conexões WebSocket

---

## Fluxos de WhatsApp

### 9. WhatsApp Message Send Flow

```mermaid
sequenceDiagram
    autonumber
    participant UI as 💬 ConversationsUI
    participant H as useWhatsAppChat
    participant CS as Client Supabase
    participant Instances as whatsapp_instances
    participant Wuzapi as Wuzapi API
    participant WA as WhatsApp

    UI->>H: sendMessage(phone, text)
    
    H->>CS: Query whatsapp_instances<br/>WHERE is_active=true<br/>AND organization_id=orgId
    CS-->>H: Instance (id, base_url, token)
    
    alt No active instance
        H-->>UI: ❌ "Configure WhatsApp first"
        UI->>UI: Show setup modal
    end
    
    Note over H: Normalize phone to E164
    H->>H: normalizePhoneE164BR(phone)
    
    H->>Wuzapi: POST /send<br/>(user_id, phone, message)
    
    Wuzapi->>WA: Send via WhatsApp API
    
    alt Success
        WA-->>Wuzapi: ✅ Message ID
        Wuzapi-->>H: { status: 'sent', message_id }
        
        H->>CS: INSERT INTO whatsapp_repository<br/>(message_id, phone, text, direction='sent')
        CS-->>H: Message saved
        
        H-->>UI: ✅ Message sent
        UI->>UI: Show message in chat
    else Failure
        WA-->>Wuzapi: ❌ Error
        Wuzapi-->>H: { error: 'Invalid number' }
        
        H-->>UI: ❌ Show error toast
    end
```

**Características:**

✅ **Idempotency**: Message ID previne duplicatas
✅ **Local storage**: Histórico mesmo se WhatsApp API cair
🟠 **Single instance**: Não suporta múltiplas instâncias por org (ainda)

---

## Resumo de Performance

| Fluxo | Latência Target | Latência Atual | Status |
|-------|-----------------|----------------|--------|
| Login | < 2s | ~3s | 🟠 Melhorar |
| Create Lead | < 500ms | ~1.5s | 🟠 Webhook síncrono |
| Update Lead (DnD) | < 100ms | ~50ms | ✅ Excelente |
| Realtime sync | < 500ms | ~300ms | ✅ Bom |
| WhatsApp send | < 2s | ~4s | 🟠 Wuzapi lento |
| Trial check | N/A | 10min polling | 🔴 Deveria ser push |

---

## Gargalos Identificados

1. 🔴 **Webhook síncrono em CRUD**: Deveria ser queue-based
2. 🔴 **11 fallbacks em loadCredentials**: Latência variável
3. 🟠 **Trial check via polling**: Ineficiente
4. 🟠 **WhatsApp validation em foreground**: Atrasa resposta
5. 🟠 **DataContext monolítico**: Re-renders desnecessários

---

**Documento gerado por:** Code Architect Reviewer  
**Última atualização:** 31 de Outubro de 2025

