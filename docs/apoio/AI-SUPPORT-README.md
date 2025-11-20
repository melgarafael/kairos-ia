# 🤖 Base de Conhecimento para Agentes de IA - Tomik CRM

Documentação completa para agentes de IA prestarem suporte técnico eficaz aos usuários do Tomik CRM.

---

## 📚 Documentos Disponíveis

### 1. 📖 [AI-SUPPORT-CONTEXT.md](./AI-SUPPORT-CONTEXT.md)
**Documento Principal - Base de Conhecimento Completa**

Conteúdo:
- ✅ Hierarquia de planos (Trial, Básico, Profissional, Enterprise)
- ✅ Sistema de tokens de plano (mensal, anual, vitalício, frozen)
- ✅ Add-ons (organizações extra, assentos extra)
- ✅ Tratativas completas para erros no SupabaseAutoUpdater
  - Passo 1: Service Role Key
  - Passo 2: Edge Function
  - Passo 3: DATABASE_URL (incluindo erro de senha)
- ✅ Erros relacionados ao banco Supabase
  - Conexão e autenticação
  - RLS (Row Level Security)
  - Schema e migrações
  - Quotas e limites
- ✅ Erros de acesso a organização (OrganizationDiagnostics)
  - Projeto pausado
  - Projeto deletado
  - Problemas de DNS
  - Sincronização Master-Client
  - Ownership e memberships
- ✅ Glossário de termos técnicos
- ✅ Quando escalar para suporte técnico

**Tamanho**: ~8.000 palavras  
**Uso**: Consulta detalhada e referência completa

---

### 2. 💬 [AI-SUPPORT-AGENT-PROMPTS.md](./AI-SUPPORT-AGENT-PROMPTS.md)
**Prompts Otimizados para Agentes**

Conteúdo:
- ✅ Prompt base para agente de suporte (system message)
- ✅ Prompts específicos por cenário:
  1. Erro de acesso à organização
  2. Problema com SupabaseAutoUpdater
  3. Projeto Supabase pausado
  4. Projeto Supabase deletado
  5. Erro de senha do banco (DATABASE_URL)
  6. Erro de RLS (permissão negada)
  7. Escalonamento para suporte técnico
- ✅ Prompt de educação (explicar conceitos)
- ✅ Prompt de análise (diagnóstico avançado)
- ✅ Atalhos de resposta rápida
- ✅ Prompt de empatia (situações críticas)
- ✅ Métricas de sucesso

**Tamanho**: ~3.500 palavras  
**Uso**: Implementação direta em sistemas de chat/agentes

---

### 3. ⚡ [AI-SUPPORT-QUICK-REFERENCE.md](./AI-SUPPORT-QUICK-REFERENCE.md)
**Referência Rápida - Cheat Sheet**

Conteúdo:
- ✅ Árvores de decisão (diagnóstico rápido)
- ✅ Tabelas de referência (planos, tokens, add-ons)
- ✅ 10 erros mais comuns + soluções rápidas
- ✅ Interpretação do OrganizationDiagnostics
- ✅ Conceitos de arquitetura (Master vs Client)
- ✅ Scripts SQL úteis
- ✅ Frases prontas por situação
- ✅ Dicas de comunicação (fazer/evitar)
- ✅ Métricas de qualidade

**Tamanho**: ~2.500 palavras  
**Uso**: Consulta rápida durante atendimento

---

### 4. 🔄 [AI-SUPPORT-FLOWS.md](./AI-SUPPORT-FLOWS.md)
**Fluxogramas e Diagramas de Processo**

Conteúdo:
- ✅ Fluxograma completo de troubleshooting
- ✅ Diagrama de arquitetura Master-Client
- ✅ Fluxo de autenticação
- ✅ Fluxo de aplicação de tokens
- ✅ Processo de resincronização
- ✅ Pipeline de diagnóstico de organização

**Tamanho**: ~1.500 palavras  
**Uso**: Visualização de processos complexos

---

## 🚀 Como Usar Esta Base de Conhecimento

### Para Implementadores de IA

#### 1. **System Prompt Base**
Use o prompt do arquivo `AI-SUPPORT-AGENT-PROMPTS.md` seção "PROMPT BASE" como system message do seu agente:

```python
system_prompt = load_file("AI-SUPPORT-AGENT-PROMPTS.md", section="PROMPT_BASE")
```

#### 2. **Contexto Dinâmico**
Injete seções relevantes do `AI-SUPPORT-CONTEXT.md` baseado no problema:

```python
if "supabase auto updater" in user_message.lower():
    context = load_file("AI-SUPPORT-CONTEXT.md", section="TRATATIVAS_PARA_ERROS_NO_SUPABASE_AUTO_UPDATER")
```

#### 3. **Respostas Rápidas**
Use templates do `AI-SUPPORT-QUICK-REFERENCE.md` para respostas padronizadas:

```python
if detected_issue == "projeto_pausado":
    response = load_template("AI-SUPPORT-QUICK-REFERENCE.md", template="PROJETO_PAUSADO_QUICK")
```

#### 4. **Fluxos Visuais**
Mostre diagramas do `AI-SUPPORT-FLOWS.md` quando explicar processos:

```python
if "como funciona autenticação" in user_message.lower():
    diagram = load_file("AI-SUPPORT-FLOWS.md", section="FLUXO_AUTENTICACAO")
```

---

### Para Agentes de IA

#### Primeira Interação
1. Ler `AI-SUPPORT-CONTEXT.md` seção "Hierarquia de Planos" para entender o produto
2. Memorizar os 10 erros mais comuns de `AI-SUPPORT-QUICK-REFERENCE.md`
3. Ter `AI-SUPPORT-AGENT-PROMPTS.md` como guia de tom e estrutura

#### Durante Atendimento
1. **Consulta rápida**: `AI-SUPPORT-QUICK-REFERENCE.md` (árvore de decisão)
2. **Detalhamento**: `AI-SUPPORT-CONTEXT.md` (seção específica)
3. **Resposta**: `AI-SUPPORT-AGENT-PROMPTS.md` (template do cenário)
4. **Visualização**: `AI-SUPPORT-FLOWS.md` (se precisar explicar processo)

#### Fluxo de Trabalho Típico
```
1. Usuário relata problema
   ↓
2. Consultar árvore de decisão (QUICK-REFERENCE)
   ↓
3. Identificar categoria do problema
   ↓
4. Ler contexto detalhado (CONTEXT)
   ↓
5. Aplicar prompt específico (PROMPTS)
   ↓
6. Fornecer solução passo a passo
   ↓
7. Validar se resolveu
   ↓
8. Escalar se necessário
```

---

## 📊 Cobertura por Tópico

### Planos e Billing ✅ 100%
- [x] Hierarquia completa de planos
- [x] Limites e features de cada plano
- [x] Sistema de tokens (mensal/anual/vitalício)
- [x] Frozen tokens e casos de uso
- [x] Add-ons (organizações + assentos)
- [x] Fluxo de aplicação de tokens

### Erros do SupabaseAutoUpdater ✅ 100%
- [x] Passo 1: Service Role Key (configuração e troubleshooting)
- [x] Passo 2: Edge Function (criação, deploy, código desatualizado)
- [x] Passo 3: DATABASE_URL (configuração, erro de senha, encoding)
- [x] Erros de planejamento/aplicação
- [x] Lock busy e timeout
- [x] saas_organizations não encontrada

### Erros de Banco Supabase ✅ 100%
- [x] Conexão e autenticação
- [x] RLS (Row Level Security)
- [x] Schema desatualizado
- [x] Migrações falhando
- [x] Quotas excedidas
- [x] Tabelas não encontradas

### Erros de Organização ✅ 100%
- [x] 5 verificações do OrganizationDiagnostics
- [x] Projeto pausado (detecção e solução)
- [x] Projeto deletado (resincronização completa)
- [x] DNS não resolve
- [x] Sincronização Master-Client
- [x] Ownership e memberships
- [x] Edge Function access

### Conceitos Técnicos ✅ 100%
- [x] Arquitetura Master-Client
- [x] Multi-tenancy e isolamento
- [x] Autenticação e JWT
- [x] RLS e políticas
- [x] Service Role vs Anon Key
- [x] Edge Functions
- [x] Provisioning e resync

---

## 🎯 Cenários de Uso

### Cenário 1: Novo Agente Treinando
**Documentos a ler (ordem)**:
1. ✅ Esta página (README) - Overview
2. ✅ `AI-SUPPORT-QUICK-REFERENCE.md` - Erros comuns
3. ✅ `AI-SUPPORT-CONTEXT.md` - Conhecimento profundo
4. ✅ `AI-SUPPORT-AGENT-PROMPTS.md` - Como responder
5. ✅ `AI-SUPPORT-FLOWS.md` - Processos visuais

**Tempo estimado**: 2-3 horas de leitura

---

### Cenário 2: Atendimento em Tempo Real
**Fluxo de consulta**:
1. 🔍 Identificar tipo de erro (mensagem do usuário)
2. ⚡ `QUICK-REFERENCE` → Árvore de decisão (30 segundos)
3. 📖 `CONTEXT` → Seção específica (1-2 minutos)
4. 💬 `PROMPTS` → Template de resposta (30 segundos)
5. ✅ Responder ao usuário (1-2 minutos)

**Tempo total**: 3-5 minutos por atendimento

---

### Cenário 3: Problema Complexo
**Abordagem**:
1. 📊 `FLOWS` → Entender o processo completo
2. 📖 `CONTEXT` → Ler seção detalhada
3. 🔬 `PROMPTS` → Usar "Análise Técnica Avançada"
4. 💬 `PROMPTS` → Template de escalonamento (se necessário)

**Tempo**: 10-15 minutos de análise

---

## 🔄 Atualização e Manutenção

### Versionamento
- **Versão atual**: 1.0
- **Data**: 2025-11-13
- **Próxima revisão**: Mensal

### Como Contribuir
1. Identificar gaps de conhecimento durante atendimentos
2. Registrar novos erros recorrentes
3. Sugerir melhorias nos prompts
4. Atualizar quando houver mudanças no sistema

### Changelog
- **v1.0 (2025-11-13)**: Criação inicial completa
  - Base de conhecimento sobre planos, tokens e add-ons
  - Troubleshooting completo do SupabaseAutoUpdater
  - Erros de banco Supabase
  - Diagnóstico de organizações
  - Prompts otimizados
  - Referência rápida

---

## 📞 Contato e Suporte

### Para Dúvidas sobre os Documentos
- **Slack**: #ai-support-docs
- **Email**: tech@tomikcrm.com.br

### Para Reportar Erros/Inconsistências
- **Issue Tracker**: GitHub/Issues
- **Formato**: [BUG DOC] Título do problema

### Para Sugerir Melhorias
- **Issue Tracker**: GitHub/Issues
- **Formato**: [ENHANCE DOC] Título da sugestão

---

## 🏆 Métricas de Sucesso

### Objetivos da Base de Conhecimento
- ✅ 80%+ dos atendimentos resolvidos na primeira interação
- ✅ < 5 minutos de tempo médio de atendimento
- ✅ 95%+ de satisfação do usuário
- ✅ < 5% taxa de escalonamento

### Como Medir
- Tracking de tempo de atendimento
- Survey de satisfação pós-atendimento
- Taxa de resolução (resolvido/não resolvido)
- Número de escalonamentos vs. resoluções

---

## 📚 Recursos Adicionais

### Documentação Técnica Completa
- `/docs/` - Toda a documentação do Tomik CRM
- `/supabase/` - Schema e migrações SQL
- `/src/components/features/Auth/` - Componentes relacionados

### Vídeos de Treinamento
- Tutorial SupabaseAutoUpdater: `public/videos/Tutorial - Atualizar Supabase.mp4`
- Onboarding: `public/videos/Video onboarding.mp4`

### Ferramentas de Diagnóstico
- **OrganizationDiagnosticsModal**: Componente de diagnóstico completo
- **SupabaseAutoUpdater**: Sistema de atualização de schema
- **Admin Analytics**: Painel de métricas e monitoramento

---

*Última atualização: 2025-11-13*  
*Versão: 1.0*  
*Mantido por: Equipe Técnica Tomik CRM*


