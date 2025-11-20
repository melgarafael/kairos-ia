# Refactors

## Q&A e Prompts — Transformação Mágica Jobsiana — Janeiro 2025

### 🧠 Transformação: Filosofia Steve Jobs no Cérebro do Sistema

**Objetivo**: Transformar a área de Q&A e gestão de prompts de uma interface técnica "tipo planilha" em uma experiência mágica, poética e visualmente envolvente — onde organizar conhecimento pareça natural, intuitivo e inevitável.

**Documentação Completa:**
- `docs/refactors/qna-magic-experience-blueprint.md` - Blueprint completo da transformação

**Arquivos Criados:**
- `src/components/features/QnA/NeuralCard.tsx` - Card base com glassmorphism e animações
- `src/components/features/QnA/NeuralLink.tsx` - Visualização de conexões neurais (linhas animadas)
- `src/components/features/QnA/FocusModal.tsx` - Modal translúcido com modo foco
- `src/components/features/QnA/SynapseCard.tsx` - Card de Q&A (sinapse pulsante)
- `src/components/features/QnA/BrainRegionCard.tsx` - Card de Prompt (região cerebral)

**Arquivos Modificados:**
- `src/components/features/QnA/QnATab.tsx` - Transformação completa com glassmorphism, animações mágicas, cards neurais

**O Problema Original:**
- ❌ **Interface tipo planilha**: Cards sólidos, sem profundidade visual
- ❌ **Sem magia**: Animações robóticas (200ms), sem ritmo humano
- ❌ **Visual frio**: Backgrounds opacos, sem glassmorphism
- ❌ **Falta de metáfora**: Não transmitia a ideia de "cérebro vivo"

**A Solução:**

#### 1. Conceito: "O Cérebro Silencioso"
- **Cada Q&A** = uma sinapse (ponto de conexão)
- **Cada Prompt** = uma região cerebral (função especializada)
- **O painel inteiro** = o neocórtex da organização

#### 2. Glassmorphism Real
- **Fundo**: `#0e0e10` com grain sutil (texture overlay)
- **Container**: `bg-white/95 dark:bg-[#121518]/95 backdrop-blur-xl`
- **Cards**: Translúcidos com bordas de luz dinâmica
- **Sombras**: Difusas e direcionais (`shadow-lg` com elevação sutil)

#### 3. Animações com Ritmo Humano
- **Duração**: `450ms - 600ms ease-out` (não 200ms robótico)
- **Stagger**: Cards aparecem em sequência (delay incremental)
- **Hover**: `scale-105` com `shadow-xl` para elevação
- **Focus**: Glow primary sutil (`focus:shadow-lg focus:shadow-primary/10`)

#### 4. Paleta de Cores por Função Cerebral
- **Roxo** (`purple-500/20`): Linguagem e empatia (Prompts humanos)
- **Azul** (`blue-500/20`): Lógica e estrutura (Prompts técnicos)
- **Verde** (`green-500/20`): Operação e execução (n8n, automações)
- **Dourado** (`amber-500/20`): Conhecimento de negócio (Q&A comerciais)
- **Cinza** (`muted`): Estrutura, não decoração (Jobs: "Use cinza para estrutura")

#### 5. Componentes Neurais
- **SynapseCard**: Card de Q&A com pulso luminoso (atividade recente)
- **BrainRegionCard**: Card de Prompt com badges de características
- **NeuralCard**: Base translúcida com animações suaves
- **FocusModal**: Modal com blur e som ambiente (modo foco)

#### 6. Micro-Magia
- **Criação**: Card "nasce" com pulso luminoso
- **Pesquisa**: Resultados "emergem" como memórias ativadas
- **Hover**: Cursor vivo com glow sutil, cards elevam
- **Tooltips**: Poéticos ("Este prompt é usado por James e Athos")

#### 7. Tipografia Apple
- **Títulos**: `text-2xl font-semibold` com `letter-spacing: -0.02em`
- **Corpo**: `text-sm` com `line-height: 1.5`
- **Fonte**: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter"`

**Princípios Aplicados:**
- **"A tecnologia deve desaparecer para que a magia apareça"** (Jobs)
- **Clareza (HIG)**: Tipografia legível, hierarquia visual nítida
- **Deferência (HIG)**: Conteúdo como herói, interface invisível
- **Profundidade (HIG)**: Elevação, transições que comunicam hierarquia
- **Simplicidade (Ive)**: Reduzir e reduzir — apenas o essencial
- **Micro-Magia (Jobs)**: Surpresas sutis que transmitam cuidado

**Resultado:**
- ✅ Usuário sente "paz" ao olhar (não ansiedade)
- ✅ Interface transmite "serenidade" e "controle"
- ✅ Cards parecem flutuar (glassmorphism real)
- ✅ Animações suaves e naturais (não robóticas)
- ✅ Experiência transmite "magia" e não "técnica"
- ✅ Metáfora neural clara (sinapses, regiões cerebrais)

**Detalhes Técnicos Implementados:**
- **NeuralCard**: `backdrop-blur-xl`, `bg-white/95 dark:bg-[#121518]/95`, animações com `framer-motion`
- **SynapseCard**: Badge de categoria, pergunta em destaque, resposta truncada, ações no hover
- **BrainRegionCard**: Badges de características (tone, schema, feedbacks, few-shots), preview do conteúdo
- **FocusModal**: Overlay com `bg-black/50 backdrop-blur-md`, conteúdo com `scale(0.95 → 1.0)`
- **Busca**: Input com glow mágico no focus (`focus:ring-2 focus:ring-primary/20 focus:shadow-lg`)
- **Grid**: `gap-6` (espaçamento generoso), animações com stagger

**Steve Jobs aprovaria:** *"Agora sim. Não é gerenciar conhecimento. É sentir o conhecimento. É poesia. É ver a luz passando entre as ideias."*

---

## Agenda — Transformação Mágica Jobsiana — Janeiro 2025

### 🪄 Transformação: Filosofia Steve Jobs nos Modais e Header

**Objetivo**: Trazer magia e encantamento para os modais e header de busca/filtros da agenda, criando uma experiência serena e visualmente envolvente — onde gerenciar tempo pareça natural, mágico e inevitável.

**Documentação Completa:**
- `docs/refactors/agenda-magic-experience-blueprint.md` - Blueprint completo da transformação

**Arquivos Criados:**
- `src/components/features/Agenda/EinsteinQuote.tsx` - Componente com frase de Einstein e efeito de digitação

**Arquivos Modificados:**
- `src/components/features/Agenda/NewAppointmentModal.tsx` - Transformado com glassmorphism completo, inputs com glow mágico, botões com gradientes emocionais, integração com EinsteinQuote
- `src/components/features/Agenda/AppointmentDetails.tsx` - Transformado com glassmorphism, cards com gradientes emocionais por seção (azul=cliente, verde=colaborador, laranja=data/hora, roxo=observações)
- `src/components/features/Agenda/Agenda.tsx` - Seção do calendário com glassmorphism aprimorado
- `src/components/features/Agenda/AgendaCalendar.tsx` - Eventos como camadas de luz translúcidas, células com backdrop-blur, hover states mágicos

**O Problema Original:**
- ❌ **Modais sólidos e frios**: Backgrounds opacos, sem profundidade visual
- ❌ **Inputs sem magia**: Campos de texto sem glow ou feedback visual
- ❌ **Header funcional mas sem alma**: Busca e filtros sem personalidade
- ❌ **Falta de micro-magia**: Sem surpresas sutis que transmitam cuidado

**A Solução:**

#### 1. Glassmorphism Sutil
- **Modais**: `backdrop-blur-xl` com `bg-white/95 dark:bg-[#121518]/95`
- **Cards**: Gradientes translúcidos (`from-blue-500/10 via-transparent to-purple-500/10`)
- **Bordas**: Translúcidas com glow (`border-blue-500/20`)
- **Sombras**: Como bruma, não caixas (`shadow-lg` com elevação sutil)

#### 2. Micro-Animações com Ritmo Humano
- **Duração**: `450ms - 600ms ease-out` (não 200ms robótico)
- **Stagger**: Cards aparecem em sequência (delay incremental)
- **Hover**: `scale-105` com `shadow-xl` para elevação
- **Focus**: Glow primary sutil (`focus:shadow-lg focus:shadow-primary/10`)

#### 3. Paleta Monocromática (Jobs: "Use cinza para estrutura, azul para ação")
- **Cinza/Muted**: Estrutura, cards, ícones, textos secundários
- **Primary (Azul)**: Apenas para ações principais e focus states
- **Sem gradientes coloridos**: Cards usam `bg-background/50` translúcido, não gradientes azul/verde/laranja/roxo
- **Ícones monocromáticos**: `bg-muted/50` com `text-muted-foreground`

#### 4. Frase de Einstein com Efeito de Digitação
- Componente `EinsteinQuote` aparece apenas na criação (não edição)
- Efeito typewriter (30ms por caractere)
- Fonte serif italic para profundidade
- Delay de 500ms para não competir com o formulário

#### 5. Inputs com Glow Mágico
- Background translúcido: `bg-background/50 dark:bg-card/50`
- Focus: Borda azul + ring + shadow glow
- Transições suaves: `duration-300`
- Ícone de busca muda de cor no focus

#### 6. Botões com Gradientes e Elevação
- Botão primário: `bg-gradient-to-r from-blue-500 to-purple-500`
- Hover: `scale-105` + `shadow-xl`
- Transições: `duration-300 ease-out`
- Pills de seleção: Gradiente quando ativo

**Princípios Aplicados:**
- **"A tecnologia deve desaparecer para que a magia apareça"** (Jobs)
- **Clareza (HIG)**: Tipografia legível, hierarquia visual nítida
- **Deferência (HIG)**: Conteúdo como herói, interface invisível
- **Profundidade (HIG)**: Elevação, transições que comunicam hierarquia
- **Simplicidade (Ive)**: Reduzir e reduzir — apenas o essencial
- **Micro-Magia (Jobs)**: Surpresas sutis que transmitam cuidado

**Resultado:**
- ✅ Usuário sente "paz" ao olhar a agenda (não ansiedade)
- ✅ Modais transmitem "serenidade" e "controle"
- ✅ Inputs com feedback visual imediato e mágico (glow primary sutil)
- ✅ Calendário com eventos como camadas de luz translúcidas
- ✅ Cards de detalhes monocromáticos e elegantes (cinza para estrutura)
- ✅ Frase de Einstein aparece na criação com efeito typewriter
- ✅ Botões com primary e micro-animações (sem gradientes coloridos)
- ✅ Experiência transmite "magia" e não "técnica"

**Detalhes Técnicos Implementados:**
- **EinsteinQuote**: Componente com efeito typewriter (30ms/caractere), delay 500ms, fonte serif italic
- **Inputs**: Background translúcido (`bg-background/50`), focus com glow primary (não cores diferentes por contexto)
- **Botões Pills**: Primary quando ativos (não gradientes coloridos)
- **Cards de Detalhes**: Background translúcido monocromático (`bg-background/50`), bordas `border-border/30`, ícones `bg-muted/50`
- **Eventos no Calendário**: Background translúcido (`bg-{color}-500/80` para status), backdrop-blur, hover com scale e shadow
- **Células do Calendário**: Background translúcido com backdrop-blur, hover states suaves, drag-over com highlight primary
- **Design Monocromático**: Removidos gradientes azul/verde/laranja/roxo dos cards; apenas cinza para estrutura, primary para ação

**Steve Jobs aprovaria:** *"Agora sim. Não é gerenciar tempo. É sentir o tempo. É poesia."*

---

## Conexões Vivas (Webhooks) — Janeiro 2025

### 🪄 Transformação Mágica: Filosofia Steve Jobs

**Objetivo**: Transformar a área de webhooks de um painel técnico denso em uma experiência poética, intuitiva e visualmente envolvente — onde integrar sistemas pareça natural, mágico e inevitável.

**Documentação Completa:**
- `docs/refactors/webhooks-magic-experience-blueprint.md` - Blueprint completo da transformação
- `docs/refactors/webhooks-magic-experience-complete.md` - Resumo da implementação

**Arquivos Criados:**
- `src/components/features/Automation/ConnectionsVivas/ConnectionsVivas.tsx` - Componente principal
- `src/components/features/Automation/ConnectionsVivas/ConnectionCard.tsx` - Card individual com pulso
- `src/components/features/Automation/ConnectionsVivas/ConnectionWizard.tsx` - Wizard narrativo em 4 etapas
- `src/components/features/Automation/ConnectionsVivas/EnergyFlow.tsx` - Visualização de fluxo de energia

**Arquivos Modificados:**
- `src/components/features/Automation/AutomationDashboard.tsx` - Atualizado para usar ConnectionsVivas

**O Problema Original:**
- ❌ **Nomenclatura técnica**: "Webhooks", "Endpoint", "Payload" — assustador para não-técnicos
- ❌ **Formulário denso**: Múltiplos campos técnicos expostos de uma vez
- ❌ **Visual frio**: Tabelas, métricas numéricas sem contexto emocional
- ❌ **Experiência fragmentada**: Criação, edição e visualização desconectadas

**A Solução:**

#### 1. Renomeação Poética
- **Antes**: "Webhooks" → **Depois**: "Conexões Vivas"
- **Antes**: "Event Type" → **Depois**: "Momento" / "Respiração"
- **Antes**: "Ativo/Inativo" → **Depois**: "Viva/Pausada"
- **Antes**: "Último disparo" → **Depois**: "Última respiração"

#### 2. Wizard Narrativo em 4 Atos
1. **"Quando algo acontecer no Tomik..."** - Seleção de eventos em linguagem natural
2. **"Envie essas informações para..."** - Configuração de destino com preview
3. **"Dê um nome e proteja sua conexão"** - Nome e autenticação simplificada
4. **"Quase lá! Ajustes finais"** - Configurações avançadas opcionais

#### 3. Visualização de Fluxo de Energia
- Linhas animadas conectando Tomik → Destino
- Partículas de energia fluindo quando ativo
- Pulsação visual em conexões vivas
- Status com cores e animações sutis

#### 4. Design Visual Mágico
- **Fundo**: Translúcido com backdrop-blur (vidro líquido)
- **Cards**: Flutuantes com micro-glow e sombras suaves
- **Animações**: Fade + scale (0.98 → 1.0), pulsações sutis
- **Cores**: Gradientes azul-púrpura-rosa para conexões ativas
- **Espaçamento**: Generoso, respeitando espaço negativo (Jobs)

#### 5. Microdetalhes e Magia
- Pulsação visual quando conexão está ativa
- Animações de fluxo de energia em tempo real
- Feedback visual imediato (toasts poéticos)
- Transições suaves (cubic-bezier natural)
- Hover states com elevação sutil

**Princípios Aplicados:**
- **"A tecnologia deve desaparecer para que a magia apareça"** (Jobs)
- **Clareza (HIG)**: Linguagem natural, hierarquia visual nítida
- **Deferência (HIG)**: Conteúdo como herói, interface invisível
- **Profundidade (HIG)**: Elevação, transições que comunicam hierarquia
- **Simplicidade (Ive)**: Wizard em etapas, progressive disclosure
- **Poesia (Jobs)**: Nomes que comunicam vida, não técnica

**Resultado:**
- ✅ Usuário cria conexão em < 2 minutos (antes: 5-10min)
- ✅ Interface não assusta usuários não-técnicos
- ✅ Visualização de fluxo é intuitiva e mágica
- ✅ Experiência transmite "magia" e não "técnica"
- ✅ Compatibilidade mantida com backend existente

**Steve Jobs aprovaria:** *"Agora sim. Não é integração. É conexão. É vida. É poesia."*

---

## Área de Automação n8n — Novembro 2025

### 🎯 Refatoração Completa: Mentalidade Steve Jobs

**Objetivo**: Eliminar paralisia de decisão e criar jornada narrativa clara seguindo os princípios mais radicais de Steve Jobs sobre foco e simplicidade.

**Documentação Completa:**
- `docs/design-refactor-automation-steve-jobs.md` - Análise crítica completa estilo Steve Jobs

**Arquivos Modificados:**
- `src/components/features/Automation/AutomationOverview.tsx` - Refatoração completa da landing page
- `src/components/features/Automation/AutomationDashboard.tsx` - Sidebar repensada com progressive disclosure

**O Problema Original:**
- ❌ **8 abas iguais competindo por atenção** - Nenhuma hierarquia, paralisia de decisão
- ❌ **Tipografia genérica** - Tudo 14px, sem destaque para ação principal
- ❌ **Arco-íris desnecessário** - Gradientes azul/roxo/ciano sem propósito semântico
- ❌ **Grid 3×3 de cards iguais** - Sem jornada narrativa, sem priorização

**A Solução:**

#### 1. Jornada Narrativa Clara (não 8 abas iguais)
```
ANTES: [Aba 1] [Aba 2] [Aba 3] [Aba 4] [Aba 5] [Aba 6] [Aba 7] [Aba 8]

DEPOIS:
┌──────────────────────────────────────┐
│  CARD GIGANTE (Ação Principal)       │
│  "Instale um Agente de IA pronto"    │
│  "Recomendado para iniciantes"       │
└──────────────────────────────────────┘

┌────────────────┐  ┌────────────────┐
│  Biblioteca    │  │  Webhooks &    │
│  de Nodes      │  │  Triggers      │
└────────────────┘  └────────────────┘

     Ferramentas avançadas ↓
```

#### 2. Hierarquia Tipográfica Radical
- Hero: **80px** (antes: 24-36px)
- Card principal: **48px** (antes: 16px)
- Cards secundários: **32px** (antes: 16px)
- Cards pequenos: **18px** (antes: 14px)

#### 3. Ícones com Presença
- Hero: **80×80px** (antes: 40×40px)
- Card principal: **80×80px** (antes: 32×32px)
- Cards médios: **64×64px** (antes: 32×32px)
- Cards pequenos: **48×48px** (antes: 16×16px)

#### 4. Cores Monocromáticas (Sem Arco-íris)
- ⚪ **Cinzas:** Estrutura, ícones, backgrounds (`bg-muted/10`, `text-foreground/70`)
- 🔵 **Azul:** Ação primária APENAS quando necessário (`bg-primary`, `hover:border-primary/40`)
- ❌ **Removido:** Gradientes coloridos (from-blue-600/20 via-indigo-500/10 to-cyan-500/20)
- ❌ **Removido:** Ícones com gradientes (bg-gradient-to-br from-blue-600 to-indigo-600)

#### 5. Progressive Disclosure
- **Primeira tela:** 3 cartões principais (Agentes, Nodes, Webhooks)
- **Seção "Ferramentas avançadas":** Mais abaixo, sem competir
- **Sidebar:** Só aparece quando sai da apresentação + botão "Voltar ao Início"

#### 6. Micro-interações com Propósito
```tsx
// Hover states que comunicam, não decoram
group-hover:scale-105          // Ícone cresce 5%
translate-x-2                   // ChevronRight desliza 8px
border-primary/40               // Borda azul sutil
transition-all duration-300     // 300ms suave
```

**Princípios Aplicados:**
- **Foco Absoluto (Jobs):** 1 ação principal iluminada, resto em segundo plano
- **Simplicidade Verdadeira (Ive):** "Reduzir e reduzir" - sem elementos competitivos
- **Clareza (HIG):** Tipografia ≥18px, hierarquia visual nítida
- **Deferência (HIG):** Conteúdo como herói, interface invisível
- **Profundidade (HIG):** Elevação sutil, transições comunicam hierarquia
- **Progressive Disclosure (Tog):** Descobribilidade sem sobrecarregar

**Resultado:**
- ✅ Usuário vê card gigante → lê "Recomendado para iniciantes" → clica → sucesso em 3min
- ✅ Sidebar limpa com "Voltar ao Início" sempre visível
- ✅ Sem arco-íris, apenas cinzas + azul estratégico
- ✅ Hierarquia tipográfica que guia o olhar naturalmente

**Steve Jobs aprovaria:** *"Agora sim. Uma escolha clara. Um caminho iluminado. O resto? Progressive disclosure."*

---

## Biblioteca de Nodes (Templates) — Novembro 2025

### 🎨 Refatoração Apple-like Completa + Minimalismo de Cores

**Objetivo**: Transformar a biblioteca de nodes Supabase em uma experiência clara, focada e elegante seguindo princípios Apple HIG.

**Arquivos Criados:**
- `docs/design-refactor-templates-apple-ux.md` - Blueprint completo da refatoração UX
- `docs/design-refactor-templates-colors-minimalist.md` - Filosofia minimalista de cores
- `src/components/features/Automation/NodeCard.tsx` - Componente modular para cards de nodes
- `src/components/features/Automation/UseCaseCard.tsx` - Componente para receitas prontas
- `src/components/features/Automation/RecipeCard.tsx` - Componente para templates completos

**Arquivos Modificados:**
- `src/components/features/Automation/AutomationTemplates.tsx` - Refatoração completa

**Mudanças Implementadas:**

#### Tipografia (HIG: ≥14pt corpo, ≥17pt títulos)
- ✅ Título da página: 24px → **36px bold**
- ✅ Subtítulo: 14px → **17px regular**
- ✅ Nome do node: 16px → **20px bold**
- ✅ Descrição: 12px → **15px regular**
- ✅ Nome técnico: 11px → **13px muted**

#### Hierarquia Visual
- ✅ Ícones: 32x32px → **56x56px** (featured: 64x64px)
- ✅ Border radius: 12px → **16-24px**
- ✅ Featured section destacando 3 nodes essenciais
- ✅ Tabs por categoria (não dropdown escondido)

#### Cores Minimalistas (Jobs: "Use cinza para estrutura, azul para ação. Ponto final.")
- ⚪ **Cinza**: Estrutura, ícones, badges, backgrounds (6-8 tons)
- 🔵 **Azul**: Única cor primária para ações (botões, hover)
- 🔴 **Vermelho**: APENAS para destrutivo (deletar)
- 🟢 **Verde**: APENAS para feedback de sucesso ("Copiado!")
- ❌ **Removido**: Festival de 12+ cores (arco-íris de IAs clichês)
- ❌ **Removido**: Gradientes coloridos (7 nos ícones)
- ❌ **Removido**: Badges coloridas por tipo de ação (5 cores)
- ❌ **Removido**: Categorias coloridas (7 cores diferentes)

#### UX Melhorada
- ✅ Nomes humanos: "adicionarCliente" → **"Criar Cliente"**
- ✅ Botões: h-10 (40pt) → **h-12 (48pt)**
- ✅ Organização por tabs: Essenciais, CRM & Leads, Agenda, Receitas & Custos, Mensagens & IA, Todos
- ✅ Card do organization_id melhorado (contexto claro, menos técnico)
- ✅ Estado vazio orientador para categorias sem nodes
- ✅ Feedback visual (copiado → verde, 2s)
- ✅ Ícones monocromáticos (sem gradientes)
- ✅ Labels de ação simples (texto, não badges)

#### Componentes Modulares
- **NodeCard**: Props tipadas, featured/normal modes, **monocromático**
- **UseCaseCard**: Para receitas prontas com múltiplos nodes
- **RecipeCard**: Para templates completos importáveis

**Princípios Aplicados:**
- **Clareza (HIG)**: Tipografia legível, hierarquia nítida, alvos ≥44pt
- **Deferência (HIG)**: Conteúdo como herói, interface em segundo plano
- **Profundidade (HIG)**: Elevação, transições suaves (200ms), hover states
- **Simplicidade (Ive)**: Featured nodes, um botão primário, remoção de badges inúteis
- **Heurísticas (Nielsen)**: Status visível, feedback imediato, estados vazios orientadores
- **Minimalismo (Rams)**: Discreto, honesto, duradouro - cores não competem com conteúdo
- **Cor com propósito (Jobs)**: 1 cor primária (azul), cinza para estrutura, verde/vermelho só quando necessário

**Resultado:**
- Usuário vê 3 nodes essenciais → escolhe → copia em 10s → sucesso
- Não mais: "30+ cards técnicos iguais com arco-íris de cores" → confusão → desiste
- **Olho sabe onde pousar: no botão azul, não em 12 cores gritando**

---

## Kanban — Outubro 2025
- Blueprint criado: `docs/features/kanban/performance-blueprint.md`.
- Correção do memo de coluna para re-render confiável.
- "Carregar mais" em listas virtualizadas e infinite scroll por coluna.
- Cabeçalho em modo paginado usa contagem exata do banco.
- Logs: `docs/features/kanban/refactor-log.md` e `docs/performance-report.md`.

---

## IA Console — Unificação de Side Panels — Janeiro 2025

### 🎯 Refatoração: Painel Direito Colapsável

**Objetivo**: Eliminar competição visual entre dois side panels, melhorando a experiência do usuário e mantendo todas as funcionalidades de forma mais integrada e elegante.

**Documentação Completa:**
- `docs/refactors/blueprint-unify-side-panels.md` - Blueprint completo da refatoração

**Arquivos Criados:**
- `apps/ia-admin-panel/components/chat/mcp-executions-panel.tsx` - Componente modular para execuções MCP com estados collapsed/expanded

**Arquivos Modificados:**
- `apps/ia-admin-panel/components/chat/chat-panel.tsx` - Refatorado para usar componente colapsável, layout flex ao invés de grid

**O Problema Original:**
- ❌ **Dois side panels competindo**: Sidebar esquerdo (navegação) + Painel direito (execuções MCP)
- ❌ **Ocupação excessiva de espaço**: Grid fixo `lg:grid-cols-[1.5fr,1fr]` sempre visível
- ❌ **Falta de deferência ao conteúdo**: Painel direito sempre aberto mesmo quando vazio
- ❌ **Experiência fragmentada**: Dois painéis laterais competindo por atenção

**A Solução:**

#### 1. Painel Colapsável Inteligente
- **Estado padrão**: Colapsado (72px de largura)
- **Estado expandido**: 320px quando necessário
- **Auto-expansão**: Expande automaticamente quando novas execuções MCP chegam
- **Badge de contador**: Mostra número de execuções quando colapsado

#### 2. Layout Flex Responsivo
- **Antes**: `grid lg:grid-cols-[1.5fr,1fr]` (fixo)
- **Depois**: `flex gap-6` com `flex-1` no chat e painel colapsável
- **Mobile**: Painel direito oculto completamente (`hidden lg:block`)
- **Desktop**: Painel sempre acessível mas discreto quando colapsado

#### 3. Componente Modular
- **McpExecutionsPanel**: Componente isolado e testável
- **Props claras**: `toolLogs`, `isExpanded`, `onToggle`
- **Animações suaves**: `framer-motion` com transições de 300ms
- **Estados visuais**: Header adapta-se ao estado (colapsado/expandido)

#### 4. UX Melhorada
- **Badge visual**: Contador discreto quando colapsado
- **Botão toggle**: Sempre visível, ícone rotaciona conforme estado
- **Conteúdo**: Lista completa quando expandido, badge quando colapsado
- **Espaço para chat**: Chat ocupa espaço máximo quando painel colapsado

**Princípios Aplicados:**
- **Modularidade (Doutrina 2.1)**: Componente isolado e plugável
- **Deferência ao conteúdo (HIG)**: Painel discreto, chat como herói
- **Progressive Disclosure**: Detalhes só quando necessário
- **Simplicidade (Ive)**: Reduzir competição visual entre elementos

**Resultado:**
- ✅ Chat tem mais espaço por padrão (painel colapsado)
- ✅ Execuções MCP sempre acessíveis mas não intrusivas
- ✅ Auto-expansão quando há atividade (feedback inteligente)
- ✅ Layout responsivo mantido (mobile sem painel direito)
- ✅ Nenhuma funcionalidade perdida

**Detalhes Técnicos Implementados:**
- **McpExecutionsPanel**: `motion.aside` com animação de largura (72px ↔ 320px)
- **ChatPanel**: Layout flex, estado `isMcpPanelExpanded` gerenciado localmente
- **Auto-expand**: `setIsMcpPanelExpanded(true)` quando `toolLogs.length > 0`
- **Responsividade**: `hidden lg:block` no wrapper do painel direito
- **Animações**: Transições suaves com `ease: [0.4, 0, 0.2, 1]`

**Steve Jobs aprovaria:** *"Agora sim. O conteúdo respira. O painel sabe quando aparecer. Deferência ao que importa."*
