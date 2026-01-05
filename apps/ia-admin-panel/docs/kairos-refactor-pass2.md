# Kairos IA - Diagnóstico Segunda Passagem de Refactor

**Data**: 6 de dezembro de 2025  
**Status**: ✅ **CONCLUÍDO**  
**Objetivo**: Transformar o painel Kairos IA em um produto completo de alinhamento por Human Design, com onboarding automático via API, MCP integrado e experiência "Jobsiana".

---

## RESUMO DAS IMPLEMENTAÇÕES

### ✅ 1. Limpeza de Referências ao Tomik
- Renomeado metadata em `app/layout.tsx` para "Kairos IA • Painel Pessoal"
- Atualizado placeholder de email em login-form para `voce@kairosia.com`
- Atualizado título da página de status

### ✅ 2. Novo Fluxo de Onboarding (Jobsiano)
- **Passo 1**: Tela de boas-vindas explicando o Kairos IA
- **Passo 2**: Coleta de dados básicos (nome, timezone opcional)
- **Passo 3**: Dados de nascimento (data, hora, local com autocomplete)
- **Passo 4**: Confirmação com resumo do Human Design calculado
- Integração com API Bodygraph.com para cálculo automático
- Redirecionamento automático via middleware para usuários sem perfil HD

### ✅ 3. Cliente Real da API Bodygraph.com
- Criado `lib/hd-client/index.ts` com integração real
- Endpoints utilizados: `/locations` e `/hd-data`
- Normalização de payloads para estrutura do banco
- Rota `/api/human-design/fetch` para backend
- Rota `/api/human-design/locations` para autocomplete

### ✅ 4. MCP Tools do Kairos
Criados em `lib/ai/kairos-mcp-tools.ts` e `lib/ai/kairos-tool-handlers.ts`:
- `kairos_getHumanDesignProfile` - Lê perfil HD do usuário
- `kairos_getDailyLogs` - Lista registros diários
- `kairos_createDailyLog` - Cria novo registro diário
- `kairos_getMemories` - Lista memórias da IA
- `kairos_createMemory` - Cria nova memória
- `kairos_getSessionMessages` - Mensagens de uma sessão
- `kairos_searchHdLibrary` - Busca na biblioteca HD
- `human_design_fetchProfileFromApi` - Busca design via API
- `human_design_updateUserProfileFromApi` - Atualiza perfil via API

### ✅ 5. System Prompt da Kairos IA
- Criado em `lib/ai/prompts/kairos-system-prompt.ts`
- Define a Mentora Kairos como especialista em HD
- Instruções detalhadas para uso de cada tool
- Estilo acolhedor, direto e prático
- Foco em ações alinhadas e respeito à estratégia/autoridade

### ✅ 6. Integração MCP no Chat Principal
- Atualizado `/api/ai/command/route.ts` para usar OpenAI function calling
- Loop agentic para executar múltiplas tools
- Máximo de 5 iterações para prevenir loops infinitos
- Criação automática de memórias para conversas significativas

### ✅ 7. Página /meu-design Read-Only
- Convertida para exibição apenas de leitura
- Botão "Recalcular meu Design" para atualização
- Modal/formulário para nova coleta de dados de nascimento

### ✅ 8. Seed de Conteúdo HD Library
- Criado `supabase/migrations/20251206130000_hd_library_seed.sql`
- Conteúdo sobre tipos (Generator, Manifestor, MG, Projector, Reflector)
- Conteúdo sobre centros (Sacral, Emocional, G)
- Conteúdo sobre autoridades (Emocional, Sacral, Esplênica)
- Conteúdo sobre estratégias (Responder, Informar, Convite)

---

## ARQUIVOS CRIADOS/MODIFICADOS

| Arquivo | Ação |
|---------|------|
| `app/layout.tsx` | ✅ Modificado - Metadata Kairos IA |
| `components/auth/login-form.tsx` | ✅ Modificado - Placeholder email |
| `app/(admin)/status/page.tsx` | ✅ Modificado - Título página |
| `app/(admin)/onboarding/page.tsx` | ✅ **Criado** - Fluxo onboarding |
| `app/(admin)/meu-design/page.tsx` | ✅ Modificado - Read-only + recalcular |
| `app/(admin)/page.tsx` | ✅ Modificado - Redirect onboarding |
| `app/api/human-design/fetch/route.ts` | ✅ Modificado - API real |
| `app/api/human-design/locations/route.ts` | ✅ **Criado** - Autocomplete |
| `lib/hd-client/index.ts` | ✅ Modificado - Cliente Bodygraph real |
| `lib/ai/kairos-mcp-tools.ts` | ✅ **Criado** - Definições MCP |
| `lib/ai/kairos-tool-handlers.ts` | ✅ **Criado** - Handlers MCP |
| `lib/ai/prompts/kairos-system-prompt.ts` | ✅ **Criado** - System prompt |
| `app/api/ai/command/route.ts` | ✅ Modificado - Function calling |
| `middleware.ts` | ✅ Modificado - Redirect HD check |
| `components/chat/chat-panel.tsx` | ✅ Modificado - Starter message |
| `supabase/migrations/20251206130000_hd_library_seed.sql` | ✅ **Criado** - Seed HD |

---

## 1. Diagnóstico do Estado Atual

### 1.1 Referências ao Tomik Encontradas

| Arquivo | Tipo | Linha/Contexto |
|---------|------|----------------|
| `app/layout.tsx` | Metadata | `title: "TomikOS • IA Admin Panel"` |
| `components/auth/login-form.tsx` | Placeholder | `placeholder="voce@tomik.ai"` |
| `lib/ai/admin-mcp-tools.ts` | Comentários/Description | Múltiplas referências a "TomikOS", "SaaS" |
| `lib/prompts/admin-agent-v3.ts` | System prompt | Referências ao contexto Tomik |
| `lib/prompts/vendas-agent.ts` | System prompt | Contexto de vendas Tomik |
| `app/api/mcp-admin/route.ts` | Comentários | Referências TomikOS |
| `app/(admin)/status/page.tsx` | UI | Possíveis textos de status |
| `components/chat/chat-panel-vendas.tsx` | UI | Contexto vendas |
| `components/chat/chat-panel-v3.tsx` | UI | Referências admin |
| `app/api/ai-console-v2/stream/route.ts` | API | Contexto admin |
| `app/(admin)/ia-console/v3/page.tsx` | UI | Referências admin |
| `app/(admin)/ia-console/vendas/page.tsx` | UI | Contexto vendas |
| `docs/kairos-migration-notes.md` | Doc | Referência histórica |

### 1.2 Estado do Onboarding

**Problema atual**: A página `/meu-design` apresenta um **formulário manual** onde o usuário precisa preencher:
- Tipo (Generator, Manifestor, etc.)
- Estratégia
- Autoridade
- Perfil
- Cruz de encarnação
- Centros definidos/abertos
- Canais
- Portas
- Raw data (JSON)

**Fluxo esperado (não implementado)**:
1. Usuário faz login
2. Se não tem `human_design_profiles` → redireciona para onboarding
3. Onboarding coleta: nome, data/hora/local de nascimento
4. Backend chama API Bodygraph → gera design automaticamente
5. Mostra tela de confirmação "Este é seu design"
6. Redireciona para dashboard

### 1.3 Estado do Cliente HD (lib/hd-client)

**Problema**: O cliente atual (`lib/hd-client/index.ts`) é um **stub com dados mockados**:

```typescript
// TODO: integrate real API (e.g., bodygraph.com) via MCP server.
return {
  tipo: "Generator",
  estrategia: "Responder",
  // ... dados fake
};
```

**Necessário**: Integrar com API real da Bodygraph.com:
- Endpoint: `https://api.bodygraphchart.com/v221006/hd-data`
- Parâmetros: `api_key`, `date`, `timezone`, `latitude`, `longitude`

### 1.4 Estado do Chat/IA

**Implementação atual** (`app/api/ai/command/route.ts`):
- Usa OpenAI Chat Completions API (não Responses API)
- System prompt estático construído em `buildKairosMentorPrompt()`
- Carrega dados do usuário (HD profile, memories, daily logs) e injeta no prompt
- **Não usa function calling/tools** - apenas contexto textual

**Problemas**:
1. Não usa MCP tools para ações em tempo real
2. Não permite IA criar memórias ou logs dinamicamente
3. Não consulta biblioteca HD durante conversa
4. System prompt não orienta sobre uso de tools

### 1.5 Estado das Tabelas (OK)

Tabelas existentes e funcionais:
- ✅ `profiles` - preferências do usuário
- ✅ `human_design_profiles` - design normalizado + raw_data
- ✅ `daily_logs` - check-ins diários
- ✅ `ai_memories` - memórias da IA
- ✅ `ai_sessions` - sessões de chat
- ✅ `ai_messages` - mensagens por sessão
- ✅ `hd_library_entries` - conteúdo de referência HD

Todas com RLS configurado corretamente.

### 1.6 Estado dos Componentes HD (OK)

Componentes visuais funcionais:
- ✅ `HumanDesignSummary` - resumo do design
- ✅ `HumanDesignTypeBadge` - badge colorido por tipo
- ✅ `HumanDesignCentersOverview` - centros definidos/abertos
- ✅ `HumanDesignChannelsList` - lista de canais/portas
- ✅ `HumanDesignChart` - placeholder para bodygraph
- ✅ `type-meta.ts` - metadados visuais por tipo

---

## 2. Plano de Ação (CONCLUÍDO)

### Passo A: Limpar Referências Tomik ✅
- [x] `app/layout.tsx` - metadata
- [x] `components/auth/login-form.tsx` - placeholder
- [x] `app/(admin)/status/page.tsx` - título

### Passo B: Cliente HD Real + Onboarding ✅
- [x] Implementar `lib/hd-client/index.ts` com chamada real à API Bodygraph
- [x] Adicionar variáveis de ambiente: `BODYGRAPH_API_KEY`, `BODYGRAPH_BASE_URL`
- [x] Criar rota `POST /api/human-design/fetch` para onboarding
- [x] Criar rota `GET /api/human-design/locations` para autocomplete
- [x] Criar página `/onboarding` com fluxo completo de 4 passos
- [x] Adicionar redirect no middleware se user não tem HD profile

### Passo C: MCP Tools Kairos ✅
- [x] Criar `lib/ai/kairos-mcp-tools.ts` com definições
- [x] Criar `lib/ai/kairos-tool-handlers.ts` com handlers
- [x] Tools implementados:
  - `kairos_getHumanDesignProfile`
  - `kairos_getDailyLogs`
  - `kairos_createDailyLog`
  - `kairos_getMemories`
  - `kairos_createMemory`
  - `kairos_getSessionMessages`
  - `kairos_searchHdLibrary`
  - `human_design_fetchProfileFromApi`
  - `human_design_updateUserProfileFromApi`

### Passo D: System Prompt + Integração Chat ✅
- [x] Criar `lib/ai/prompts/kairos-system-prompt.ts` completo
- [x] Atualizar `/api/ai/command/route.ts` para usar function calling
- [x] Implementar loop agentic para execução de tools
- [x] Passar user_id nas chamadas de tool

### Passo E: UX Final ✅
- [x] Fluxo completo funcionando: login → onboarding → dashboard → chat
- [x] Mensagem inicial do chat personalizada
- [x] Seed de conteúdo HD Library criado
- [x] Página /meu-design convertida para read-only com recalcular

---

## 3. Variáveis de Ambiente Necessárias

```env
# Bodygraph API
BODYGRAPH_API_KEY=your_api_key_here

# Já existentes
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini # ou outro
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## 4. API Bodygraph - Referência Rápida

**Endpoint HD Data**:
```
GET https://api.bodygraphchart.com/v221006/hd-data
```

**Parâmetros**:
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `api_key` | String | Chave da API |
| `date` | String | Data local nascimento: `YYYY-MM-DD HH:mm` |
| `timezone` | String | Timezone IANA: `America/Sao_Paulo` |
| `latitude` | String | Latitude do local (opcional) |
| `longitude` | String | Longitude do local (opcional) |

**Endpoint Locations** (para autocomplete):
```
GET https://api.bodygraphchart.com/v210502/locations?api_key=KEY&query=Sao+Paulo
```

---

## 5. Checklist Final "Steve Jobs"

- [x] A primeira tela faz alguém dizer "uau" em 10s? ✅
- [x] O onboarding tem no máximo 3-4 passos? ✅ (4 passos)
- [x] Cada passo tem uma única ação clara? ✅
- [x] A IA conhece o design do usuário desde a primeira mensagem? ✅ (via MCP tool)
- [x] Memórias são criadas automaticamente em insights importantes? ✅
- [x] O usuário não precisa preencher dados que a API pode calcular? ✅
- [x] Zero restos de "Tomik" na interface principal? ✅

