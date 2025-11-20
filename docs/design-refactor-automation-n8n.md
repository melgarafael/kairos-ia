# 🎯 Blueprint: Refatoração Apple-like da Área de Automação n8n

> **Diretriz**: Steve Jobs eliminaria o ruído. Este documento planeja uma refatoração que aplica clareza, deferência e profundidade em cada tela.

---

## 📋 Contexto

A área de automação n8n (Tomik × n8n) contém 6 telas principais:
1. **Apresentação** - Overview geral
2. **Aprenda a Construir** - Aulas em vídeo
3. **Agentes de IA** - Templates de agentes instaláveis
4. **Webhooks** - Configurações de webhooks
5. **Templates** - Seeds de nodes Supabase
6. **Prompts** - Prompts BYO Supabase

### Problemas Identificados (Visão Jobs)

#### Hierarquia Visual Inexistente
- Botões com pesos visuais idênticos competindo (Trocar conexão vs Conectar vs Excluir)
- Botão "Instalar Agente" é frankenstein laranja-verde gritando
- Estado de conexão não tem deferência

#### Densidade Caótica
- Webhooks: URLs completas expostas, métricas microscópicas misturadas
- Cards imensos com info técnica não-hierarquizada
- Tags/badges sem significado semântico claro

#### Tipografia Fraca
- Textos pequenos (< 14pt) ilegíveis
- Contraste insuficiente (cinzas frouxos)
- Sem escala tipográfica consistente

#### Geometria Sem Alma
- Cards com tamanhos arbitrários
- Espaçamentos inconsistentes
- Raios de borda aleatórios
- Sem grid 8pt

#### Cores Sem Propósito
- Arco-íris (roxo, verde, laranja, azul, tudo junto)
- Sem mapeamento semântico claro
- Botão principal mistura duas cores

#### Estados Vazios Inexistentes
- Nenhuma orientação quando não há dados
- Oportunidades perdidas de educar

#### Falta de Foco na Ação Primária
- Tudo tem peso igual (se tudo é importante, nada é)

---

## 🎨 Princípios de Design (DESIGN-APPLE.md)

### Clareza, Deferência, Profundidade (HIG)
- Tipografia legível, hierarquia visual nítida, controles inequívocos
- Interface em segundo plano, conteúdo como herói
- Camadas/elevação que comunicam hierarquia

### Simplicidade Verdadeira (Ive)
- Remover tudo que não é essencial
- Propósito, não "falta de coisas"

### Heurísticas (Nielsen)
- Status visível
- Prevenção de erro
- Consistência
- "Reconhecer > recordar"
- Ajuda e recuperação

---

## 🛠 Especificações Técnicas

### Tipografia
- **SF Text / Inter**: 12pt mínimo legendas, 14pt corpo, 17pt título de card, 20pt título de seção, 24pt página
- **Contraste**: ≥ 4.5:1 (AA/AAA)
- **Escala**: 12/14/17/20/24/32

### Alvos de Toque
- **Mínimo**: 44×44 pt
- **Centers**: ~60pt separados
- **Espaçamentos**: 8/12/16/24

### Cores com Significado
- **Azul (primária)**: ação principal
- **Verde**: sucesso/ativo
- **Vermelho**: erro/destrutivo
- **Amarelo/laranja**: aviso
- **Cinza**: secundário/estrutura
- **Contraste**: ≥ 4.5:1

### Motion com Propósito
- **Duração**: 150-220ms
- **Easing**: padrão
- Explicar mudança, não distrair

### Grid & Espaçamento
- **Base**: 8pt
- **Respiro entre seções**: 24pt

---

## ✅ Plano de Refatoração por Tela

### 1️⃣ **Agentes de IA**

#### Antes (Problemas)
- Três botões no topo competindo
- Botão frankenstein laranja-verde
- Cards com badges coloridos sem propósito
- Texto pequeno
- Estado de conexão misturado com conteúdo

#### Depois (Solução Jobs)
- **Header limpo**: Status de conexão discreto (badge pequeno canto superior direito)
- **Hero action**: "Escolha um agente e instalaremos o workflow no seu n8n" (24pt, centro, respiro)
- **Cards grandes**:
  - Ícone grande (não microscópico), nome bold 20pt, descrição uma linha
  - Botão "Instalar" simples (azul, único, 44pt altura)
- **Excluir conexão**: em menu contextual (⋯), não na UI primária
- **Estado vazio**: "Conecte seu n8n para começar. [Conectar agora →]"

#### Implementação
- Refatorar `AIAgentsStore.tsx`
- Criar componente `ConnectionStatus.tsx` (badge discreto)
- Remover botões competitivos do topo
- Ajustar cards: tipografia 20pt título, descrição 14pt
- Modal de conexão simplificado

---

### 2️⃣ **Webhooks**

#### Antes (Problemas)
- Lista rasa com URLs completas visíveis
- Métricas microscópicas misturadas
- Tags/badges espalhados
- Sem hierarquia

#### Depois (Solução Jobs)
- **Lista compacta**:
  - Nome do webhook (17pt bold), Status (ativo/inativo - badge pequeno)
  - Última execução (14pt cinza), Taxa de sucesso (números grandes, não "Total X Sucessos Y")
- **URL escondida por padrão**: clica no nome → detalhes
- **Filtros**: chips sutis (todos/ativos/com erro)
- **Botão "+ Novo Webhook"**: canto superior direito, sozinho, azul

#### Implementação
- Refatorar `WebhookConfigurationPanel.tsx`
- Lista compacta: ocultar URL por padrão
- Modal de detalhes ao clicar no nome
- Filtros como chips (não dropdown pesado)
- Métricas: números grandes (32pt), rótulo pequeno (12pt)

---

### 3️⃣ **Templates**

#### Antes (Problemas)
- Grid uniforme sem hierarquia
- Tudo tem peso igual
- Ícone Supabase microscópico
- Nenhuma orientação sobre o que é essencial

#### Depois (Solução Jobs)
- **Hero section**: "📦 Biblioteca de Nodes Supabase" (24pt) + explicação uma linha (14pt)
- **3 templates essenciais em destaque**: cards maiores, preview visual (se possível), nome 20pt
- **Grid de templates restantes**: ícone categoria, nome 16pt, descrição curta
- **Botão "Copiar"**: único, claro (não competindo com ícone)

#### Implementação
- Refatorar `AutomationTemplates.tsx`
- Hero section destacada
- 3 templates em featured (maior, topo)
- Accordion para categorias
- Botão copiar: único, 44pt

---

### 4️⃣ **Prompts**

#### Antes (Problemas)
- Texto microscópico
- Cards todos iguais
- Preview misturado com conteúdo

#### Depois (Solução Jobs)
- **Accordion**: título do prompt visível (18pt bold), clica → expande
- **Preview de 2 linhas quando fechado**
- **Botão "Copiar prompt"**: aparece só quando expandido (44pt)
- **Tags de categoria**: pequenas e discretas (12pt)

#### Implementação
- Refatorar `AutomationPrompts.tsx`
- Accordion component (collapse/expand)
- Preview: 2 linhas, fade out
- Botão copiar: só quando expandido

---

### 5️⃣ **Aprenda a Construir**

#### Antes (Problemas)
- Thumbnails pequenos
- Sem indicador de progresso
- Duração discreta demais

#### Depois (Solução Jobs)
- **Thumbnails de vídeo maiores**: proporção 16:9 respeitada
- **Título do vídeo**: 17pt
- **Duração**: discreta mas legível (14pt)
- **Indicador de progresso**: se já assistiu (barra verde sutil)
- **Sequência numerada clara**: Aula 01 → 02 → 03

#### Implementação
- Refatorar `AutomationLearn.tsx`
- Aumentar thumbnails
- Adicionar indicador de progresso (se possível via localStorage)
- Tipografia: 17pt título

---

### 6️⃣ **Apresentação (Overview)**

#### Antes (Problemas)
- Texto corrido
- Botões pequenos
- Sem clareza de próximo passo

#### Depois (Solução Jobs)
- **Hero grande**: "Tomik × n8n" (32pt), subtítulo (17pt), respiro
- **3 ações principais em destaque**: cards grandes (Conectar n8n, Ver Agentes, Abrir Templates)
- **Diagrama**: maior, centralizado, com zoom
- **Próximos passos claros**: "1. Conecte seu n8n → 2. Instale um agente → 3. Configure webhooks"

#### Implementação
- Refatorar `AutomationOverview.tsx`
- Hero maior, tipografia 32pt
- 3 cards destacados (não 6 iguais)
- Diagram zoom
- Seção "Próximos passos" com numeração

---

## 📐 Design Tokens (Padronização)

### Cores
```js
{
  primary: 'hsl(221, 83%, 53%)',      // Azul - ação principal
  success: 'hsl(142, 76%, 36%)',      // Verde - sucesso
  destructive: 'hsl(0, 84%, 60%)',    // Vermelho - erro
  warning: 'hsl(38, 92%, 50%)',       // Laranja - aviso
  muted: 'hsl(215, 20%, 65%)',        // Cinza - secundário
  foreground: 'hsl(222, 47%, 11%)',   // Texto principal
  background: 'hsl(0, 0%, 100%)',     // Fundo
  card: 'hsl(0, 0%, 98%)',            // Card
  border: 'hsl(214, 32%, 91%)',       // Borda
}
```

### Tipografia
```js
{
  h1: '32px',      // Título de página
  h2: '24px',      // Título de seção
  h3: '20px',      // Título de card
  body: '17px',    // Título de item
  bodySmall: '14px', // Corpo
  caption: '12px', // Legendas
}
```

### Espaçamento
```js
{
  xs: '8px',
  sm: '12px',
  md: '16px',
  lg: '24px',
  xl: '32px',
}
```

### Raios
```js
{
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
}
```

### Sombras
```js
{
  sm: '0 1px 3px rgba(0,0,0,0.12)',
  md: '0 4px 6px rgba(0,0,0,0.1)',
  lg: '0 10px 15px rgba(0,0,0,0.1)',
}
```

---

## 🚀 Critérios de Sucesso

1. ✅ Hierarquia visual clara em cada tela
2. ✅ Tipografia ≥ 14pt corpo, ≥ 17pt títulos de item
3. ✅ Contraste ≥ 4.5:1 (AA)
4. ✅ Botões ≥ 44×44pt
5. ✅ Cores com significado semântico
6. ✅ Estados vazios orientadores
7. ✅ Ação primária clara (um hero por tela)
8. ✅ Progressive disclosure (info técnica escondida)
9. ✅ Whitespace de 24pt entre seções
10. ✅ Feedback imediato ("Copiado!" ao copiar)

---

## 📅 Ordem de Implementação

1. **Agentes de IA** (piloto - maior impacto, mais crítico)
2. **Webhooks** (segundo mais usado)
3. **Templates** (biblioteca essencial)
4. **Prompts** (apoio aos templates)
5. **Aprenda a Construir** (educação)
6. **Apresentação** (overview - consolida o resto)

---

## 🧪 Validação

Após cada tela:
1. Verificar tipografia (≥ 14pt corpo)
2. Testar contraste (AA no mínimo)
3. Testar alvos de toque (44×44pt)
4. Verificar estados vazios
5. Conferir feedback imediato
6. Validar ação primária clara

---

## 📝 Registro

- **Autor**: AI (sob direção de Steve Jobs)
- **Data**: 2025-11-03
- **Status**: Aprovado para execução
- **Documento vivo**: será atualizado conforme implementação

---

**"Design é remover, remover, remover até sobrar só o essencial."** - Steve Jobs

