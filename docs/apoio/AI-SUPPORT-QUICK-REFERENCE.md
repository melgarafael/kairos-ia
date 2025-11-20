# ⚡ Referência Rápida - Suporte Tomik CRM

Guia de consulta rápida para agentes de IA. Para detalhes completos, consulte `AI-SUPPORT-CONTEXT.md`.

---

## 🎯 DIAGNÓSTICO RÁPIDO

### Árvore de Decisão - Erro de Acesso

```
❌ Usuário não acessa organização
    │
    ├─ Erro 403/401? → Verificar autenticação + ownership/membership
    ├─ Erro 404? → Projeto deletado → Resincronizar
    ├─ Timeout/Sem resposta? → Projeto pausado → Retomar
    ├─ RLS error (42501)? → Verificar organization_id
    └─ Outro? → Executar OrganizationDiagnostics
```

### Árvore de Decisão - SupabaseAutoUpdater

```
❌ Não consegue atualizar banco
    │
    ├─ Passo 1 "⚠ Pendente"? → Configurar Service Role Key
    ├─ Passo 2 "⚠ Pendente"? → Criar Edge Function
    ├─ Passo 2 "⚠ Desatualizado"? → Redeploy Edge Function
    ├─ Passo 3 "⚠ Pendente"? → Configurar DATABASE_URL
    ├─ Passo 3 "⚠ Erro!"? → Corrigir senha (encoding)
    └─ "Lock busy"? → Aguardar ou desbloquear
```

---

## 📊 PLANOS - REFERÊNCIA RÁPIDA

| Plano | Preço/mês | Usuários | Pacientes | Storage | Slug |
|-------|-----------|----------|-----------|---------|------|
| **Trial** | R$ 0 | 2 | 50 | 0.5 GB | `trial` |
| **Básico** | R$ 97 | 5 | 500 | 2 GB | `basic`, `starter` |
| **Profissional** ⭐ | R$ 197 | 15 | 2.000 | 10 GB | `professional`, `pro` |
| **Enterprise** | R$ 397 | 50+ | 10.000+ | 50 GB | `enterprise` |

---

## 🎫 TOKENS - REFERÊNCIA RÁPIDA

### Estados de Token
- `available` → Disponível para uso
- `redeemed` → Aplicado a organização
- `expired` → Expirado
- `canceled` → Cancelado

### Validade
- **Mensal**: 30 dias
- **Anual**: 365 dias
- **Vitalício**: 99.999 dias

### Frozen Tokens
- Validade só começa quando aplicado
- Útil para distribuição antecipada
- Usado em promoções e pacotes

---

## 🔧 ADD-ONS DISPONÍVEIS

### Organizações Extra
- `org-extra-1` → +1 org (R$ 97/mês)
- `org-extra-5` → +5 orgs (R$ 485/mês)
- `org-extra-10` → +10 orgs (R$ 970/mês)

### Assentos Extra
- Via `saas_member_seats_grants`
- Incrementa `member_seats_extra`
- API: Edge Function `seats-grants`

---

## 🚨 ERROS COMUNS - SOLUÇÕES RÁPIDAS

### 1. Projeto Pausado
**Sintoma**: Timeout, sem resposta, badge "⏸"  
**Solução**: Supabase Dashboard → Resume Project  
**Tempo**: 1-3 minutos  
**Dados**: ✅ Preservados

### 2. Projeto Deletado
**Sintoma**: 404, DNS não resolve  
**Solução**: Resincronizar organização  
**Tempo**: 2-5 minutos  
**Dados**: ❌ Perdidos (sem recuperação)

### 3. Service Role Key Missing
**Sintoma**: "Missing bearer token", "Unauthorized"  
**Solução**: Supabase → Settings → API → Copiar `service_role` → Tomik → Salvar  
**⚠️**: Não confundir com `anon` key!

### 4. Edge Function Missing
**Sintoma**: 404, "function not found"  
**Solução**: Criar função `client-schema-updater` com código do Tomik  
**⚠️**: Nome e código devem ser exatos

### 5. DATABASE_URL - Senha Incorreta
**Sintoma**: "Unknown response for startup: N", "password authentication failed"  
**Causa**: Senha incorreta OU caracteres especiais não codificados  
**Solução**: 
1. Reset senha no Supabase
2. Digitar no Tomik (codifica automaticamente)
3. Copiar DATABASE_URL gerada
4. Atualizar secret no Supabase

**Encoding de caracteres**:
```
@ → %40   # → %23   $ → %24
% → %25   & → %26   + → %2B
```

### 6. RLS Error (42501)
**Sintoma**: "new row violates row-level security policy"  
**Causa**: Falta `organization_id` ou tentando acessar outra org  
**Solução**: 
- Verificar autenticação
- Completar onboarding se sem organização
- Adicionar membership se legítimo

### 7. Table Not Found (42P01)
**Sintoma**: "relation does not exist"  
**Causa**: Schema desatualizado  
**Solução**: SupabaseAutoUpdater → Planejar → Aplicar pendentes

### 8. Lock Busy
**Sintoma**: "Another migration process is running"  
**Solução**: Aguardar 5 min OU executar unlock SQL:
```sql
SELECT pg_advisory_unlock(hashtext('tomikcrm_schema_upgrade')::bigint);
```

### 9. Quota Exceeded
**Sintoma**: "quota exceeded", "storage limit reached"  
**Causa**: Limite do plano Supabase (não Tomik!)  
**Solução**: 
- Verificar: Supabase → Settings → Billing → Usage
- Upgrade para Supabase Pro ($25/mês)
- Limpar dados antigos

### 10. saas_organizations Not Found
**Sintoma**: Alerta amarelo no SupabaseAutoUpdater  
**Causa**: SQL inicial não foi importado  
**Solução**: Importar SQL de setup no Supabase SQL Editor

---

## 🔍 ORGANIZATIONDIAGNOSTICS - INTERPRETAÇÃO

### 5 Verificações

| Check | O que verifica | Fail comum | Solução |
|-------|----------------|------------|---------|
| **Edge Function Access** | Permissões de API | 403 Forbidden | Verificar auth + membership |
| **Project Status** | Projeto ativo? | Pausado/Deletado | Retomar ou Resincronizar |
| **DNS** | Domínio resolve? | Projeto deletado | Resincronizar |
| **Master-Client Sync** | client_org_id OK? | Não sincronizado | Verificar/Recriar registro |
| **Ownership** | Owner ou member? | Sem permissão | Adicionar membership |

### Status Geral

- ✅ **Healthy**: Tudo OK
- ⏸ **Paused**: Projeto pausado → Retomar
- ❌ **Error**: Problemas críticos → Ver checks específicos
- ⚠️ **Warning**: Atenção necessária

---

## 🗄️ ARQUITETURA - CONCEITOS

### Master vs Client Supabase

```
MASTER Supabase (SaaS)
├─ saas_users → Usuários do sistema
├─ saas_organizations → Organizações
├─ saas_plans → Planos disponíveis
├─ saas_subscriptions → Assinaturas
├─ saas_plan_tokens → Tokens de plano
├─ saas_memberships → Usuários em organizações
└─ automation_* → Gestão de clientes (do gestor)

CLIENT Supabase (Específico da Org)
├─ saas_organizations → Replica da org
├─ users → Usuários da organização
├─ patients/clients → Dados do CRM
├─ appointments → Agendamentos
├─ crm_leads → Leads
└─ processes → Processos/Kanban
```

### Fluxo de Autenticação

```
1. Usuário faz login → Master Auth
2. Master retorna JWT com user_id + organization_id
3. Frontend usa JWT para:
   - Acessar Master (dados do usuário, planos)
   - Acessar Client (dados da organização)
4. RLS filtra por organization_id automaticamente
```

### Multi-Tenancy

- Cada organização = Client Supabase separado
- Isolamento completo de dados
- RLS garante que org A não vê dados da org B
- Um usuário pode ter memberships em múltiplas orgs

---

## 🎯 SCRIPTS SQL ÚTEIS

### Verificar organização do usuário
```sql
-- No Master Supabase
SELECT u.id, u.email, u.organization_id, o.name as org_name
FROM saas_users u
LEFT JOIN saas_organizations o ON u.organization_id = o.id
WHERE u.email = 'usuario@exemplo.com';
```

### Verificar memberships
```sql
-- No Master Supabase
SELECT m.*, o.name as org_name
FROM saas_memberships m
JOIN saas_organizations o ON m.organization_id = o.id
WHERE m.user_id = 'USER_UUID';
```

### Verificar plano ativo
```sql
-- No Master Supabase
SELECT 
  o.name,
  p.name as plan_name,
  s.status,
  s.current_period_end
FROM saas_organizations o
JOIN saas_subscriptions s ON s.organization_id = o.id
JOIN saas_plans p ON s.plan_id = p.id
WHERE o.id = 'ORG_UUID';
```

### Verificar tokens disponíveis
```sql
-- No Master Supabase
SELECT 
  t.id,
  p.name as plan_name,
  t.status,
  t.valid_until,
  t.applied_organization_id
FROM saas_plan_tokens t
JOIN saas_plans p ON t.plan_id = p.id
WHERE t.owner_user_id = 'USER_UUID'
ORDER BY t.created_at DESC;
```

### Desbloquear migration lock
```sql
-- No Client Supabase
SELECT pg_advisory_unlock(hashtext('tomikcrm_schema_upgrade')::bigint);
```

### Verificar migrações aplicadas
```sql
-- No Client Supabase
SELECT id, name, applied_at 
FROM tomikcrm_schema_migrations 
ORDER BY applied_at DESC 
LIMIT 10;
```

---

## 🆘 QUANDO ESCALAR

Escale **IMEDIATAMENTE** se:
- 🔥 Perda de dados não explicada
- 🔥 Vulnerabilidade de segurança
- 🔥 Sistema completamente inacessível
- 🔥 Erro de billing/cobrança
- 🔥 Bug confirmado (não configuração)

Escale **APÓS TROUBLESHOOTING** se:
- Erro persiste após seguir todos os passos
- Edge Function não deploy (código correto)
- Migrações falhando (erro SQL complexo)
- RLS bloqueando com permissões corretas
- Performance crítica (> 30s, timeouts)
- Integração WhatsApp não funciona

**NÃO** escale se:
- Problema de configuração (falta Service Role, DATABASE_URL, etc.)
- Projeto pausado (usuário pode retomar)
- Senha incorreta (usuário pode resetar)
- Falta completar onboarding
- Dúvida sobre como usar feature

---

## 💬 FRASES PRONTAS

### Abertura
```
Olá! 👋 Vou te ajudar a resolver isso. Pode me dar mais detalhes sobre o erro que está vendo?
```

### Projeto Pausado (descoberta)
```
🟠 Identifiquei que seu projeto está pausado. Boa notícia: seus dados estão seguros! Vou te guiar para retomar em 3 minutos. 😊
```

### Projeto Deletado (descoberta)
```
😔 Infelizmente detectei que o projeto foi deletado. Vou ser transparente: dados não podem ser recuperados. Mas posso te ajudar a criar um novo projeto rapidamente. Posso explicar melhor?
```

### Solução funcionou
```
✅ Ótimo! Fico feliz que resolveu. Alguma outra dúvida? Estou aqui para ajudar! 😊
```

### Precisa escalar
```
Entendo. Vou escalar para nossa equipe técnica que vai analisar mais profundamente. Você receberá um email com o número do ticket. Obrigado pela paciência! 🙏
```

### Perda de dados (empatia)
```
Entendo completamente sua frustração. Perder dados é realmente difícil. Vou fazer o máximo para te ajudar a voltar operacional o mais rápido possível. Vamos juntos? 🤝
```

### Pedindo mais informações
```
Para te ajudar melhor, pode me enviar:
- Print da tela do erro (se possível)
- O que você estava fazendo quando deu erro
- Email que você usa no sistema

Isso vai acelerar bastante! 📊
```

---

## 🎓 DICAS DE COMUNICAÇÃO

### ✅ FAZER

- ✅ Confirmar que entendeu o problema
- ✅ Usar linguagem simples e amigável
- ✅ Passos numerados para procedimentos
- ✅ Emojis moderados (1-2 por mensagem)
- ✅ Validar se resolveu antes de encerrar
- ✅ Oferecer ajuda adicional
- ✅ Celebrar quando resolver
- ✅ Ser transparente sobre limitações

### ❌ EVITAR

- ❌ Jargão técnico desnecessário
- ❌ Respostas muito longas (quebrar em partes)
- ❌ Culpar o usuário
- ❌ Prometer o que não pode cumprir
- ❌ Sumir sem follow-up
- ❌ Usar "simplesmente" ou "apenas"
- ❌ Assumir conhecimento técnico
- ❌ Ser impaciente

---

## 📊 MÉTRICAS DE QUALIDADE

### Tempos Esperados
- ⚡ Primeira resposta: < 2 min (simples) / < 5 min (complexo)
- ⚡ Resolução: > 80% primeira interação

### Checklist por Atendimento
- [ ] Confirmou que entendeu o problema
- [ ] Diagnosticou a causa
- [ ] Forneceu solução clara
- [ ] Validou que resolveu
- [ ] Ofereceu ajuda adicional
- [ ] Tom amigável e profissional

---

## 🔗 LINKS ÚTEIS

### Documentação Completa
- Contexto completo: `AI-SUPPORT-CONTEXT.md`
- Prompts detalhados: `AI-SUPPORT-AGENT-PROMPTS.md`

### Dashboards
- Master Supabase: `https://supabase.com/dashboard/project/qckjiolragbvvpqvfhrj`
- Client (depende do project_ref): `https://supabase.com/dashboard/project/{project_ref}`

### Edge Functions
- Admin Analytics: `{edge_url}/admin-analytics`
- Plan Tokens: `{edge_url}/plan-tokens`
- Seats Grants: `{edge_url}/seats-grants`
- Saas Orgs: `{edge_url}/saas-orgs`

---

*Última atualização: 2025-11-13*
*Versão: 1.0*


