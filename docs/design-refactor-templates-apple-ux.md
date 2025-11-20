# 🎨 Blueprint: Refatoração Apple-like da Biblioteca de Nodes

> **"Simplifique até que sobre apenas o essencial."** - Steve Jobs

## 📋 Objetivo

Transformar a biblioteca de nodes Supabase (Templates) em uma experiência clara, focada e elegante, seguindo os princípios Apple HIG e as críticas diretas do "olhar Steve Jobs".

## 🎯 Problemas Identificados

### Tipografia
- ❌ Títulos muito pequenos (14-16px)
- ❌ Descrições microscópicas (12px)
- ❌ Hierarquia visual confusa

### UX
- ❌ 30+ cards iguais sem destaque
- ❌ Nomes técnicos ("adicionarCliente" vs "Criar Cliente")
- ❌ Sem progressive disclosure
- ❌ Falta estado vazio orientador
- ❌ Organização por "Todos os Nodes" não ajuda

### UI
- ❌ Ícones pequenos (32x32px)
- ❌ Botões fracos e secundários
- ❌ Cores sem propósito semântico
- ❌ Badges técnicas sem valor ("supabaseTool")

## ✅ Soluções Propostas

### 1. Hierarquia Tipográfica (HIG: ≥14pt corpo, ≥17pt títulos)

```
Título da página: 32-36px bold
Subtítulo: 17px regular
Nome do node (card): 20px bold
Nome técnico: 13px muted
Descrição: 15px regular
Badges: 12px semibold
```

### 2. Featured Nodes (Top 3-5 essenciais)

Hero section destacando:
- Criar Cliente (CRM)
- Agendar Compromisso (Agenda)
- Enviar Mensagem IA (Mensagens)

**Características:**
- Cards grandes (p-8)
- Ícones 64x64px
- Botão primário h-14 (56pt)
- Border colorida por categoria

### 3. Organização por Tabs/Categorias

```
[CRM & Leads] [Agenda] [Receitas & Custos] [Mensagens & IA] [Todos]
```

### 4. Cores Semânticas

- 🟢 Verde: Criar, Adicionar
- 🔵 Azul: Buscar, Listar
- 🟡 Amarelo: Atualizar, Editar
- 🔴 Vermelho: Deletar, Remover
- 🟣 Roxo: IA, Inteligência

### 5. Cards Apple-like

```tsx
<NodeCard>
  - Ícone: 56x56px com gradiente
  - Título: 20px bold, nome humano
  - Subtítulo: 13px muted, nome técnico
  - Descrição: 15px, 3 linhas max
  - Badge: categoria semântica
  - Botão: h-12 (48pt), variant="magic", "Usar Node"
  - Hover: border colorida + shadow-lg
</NodeCard>
```

### 6. Busca Inteligente

- Input: h-14 (56pt)
- Placeholder orientador
- Busca semântica (função, não nome técnico)

### 7. Estado Vazio Educador

- Hero com gradiente
- Tutorial de 30 segundos
- Call-to-action claro

## 🧩 Componentes Modulares (Novos)

### NodeCard.tsx
Props:
```typescript
{
  icon: ReactNode
  title: string // "Criar Cliente"
  technicalName: string // "adicionarCliente"
  description: string
  category: 'crm' | 'agenda' | 'financas' | 'mensagens' | 'produtos'
  action: 'create' | 'read' | 'update' | 'delete' | 'ai'
  onCopy: () => void
  featured?: boolean
}
```

### UseCaseCard.tsx (Receitas Prontas)
Props:
```typescript
{
  icon: string
  title: string
  description: string
  nodes: string[] // lista de nodes incluídos
  onCopy: () => void
}
```

### RecipeCard.tsx (Templates completos)
Props:
```typescript
{
  title: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  setupTime: number
  nodes: number // quantos nodes
  onCopy: () => void
}
```

## 📐 Design Tokens Aplicados

### Tipografia
```css
--text-page-title: 32px bold
--text-section-title: 24px bold
--text-card-title: 20px bold
--text-body-lg: 17px regular
--text-body: 15px regular
--text-body-sm: 14px regular
--text-caption: 13px regular
--text-label: 12px semibold
```

### Espaçamento (Grid 8pt)
```css
--space-xs: 8px
--space-sm: 12px
--space-md: 16px
--space-lg: 24px
--space-xl: 32px
--space-2xl: 48px
```

### Alvos de Toque (HIG: ≥44pt)
```css
--touch-target-xl: 56px (h-14)
--touch-target-lg: 48px (h-12)
--touch-target: 44px (h-11)
--touch-target-sm: 40px (h-10)
```

### Ícones
```css
--icon-xs: 16px (h-4 w-4)
--icon-sm: 20px (h-5 w-5)
--icon-md: 24px (h-6 w-6)
--icon-lg: 32px (h-8 w-8)
--icon-xl: 56px (h-14 w-14)
--icon-2xl: 64px (h-16 w-16)
```

### Border Radius
```css
--radius-sm: 8px
--radius-md: 12px
--radius-lg: 16px
--radius-xl: 24px
--radius-2xl: 32px
```

## 🎨 Paleta de Ações

```typescript
const actionColors = {
  create: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-600 dark:text-green-400',
    gradient: 'from-green-400 to-green-600'
  },
  read: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-600 dark:text-blue-400',
    gradient: 'from-blue-400 to-blue-600'
  },
  update: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-600 dark:text-yellow-400',
    gradient: 'from-yellow-400 to-yellow-600'
  },
  delete: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-600 dark:text-red-400',
    gradient: 'from-red-400 to-red-600'
  },
  ai: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-600 dark:text-purple-400',
    gradient: 'from-purple-400 to-purple-600'
  }
}
```

## 🔄 Fluxo de Implementação

1. ✅ Criar blueprint (este arquivo)
2. ⏳ Criar NodeCard.tsx (componente modular)
3. ⏳ Criar UseCaseCard.tsx (receitas prontas)
4. ⏳ Criar RecipeCard.tsx (templates completos)
5. ⏳ Refatorar AutomationTemplates.tsx:
   - Header Apple-like (ícone 56x56, título 32px)
   - Featured section (3-5 nodes essenciais)
   - Tabs por categoria
   - Busca inteligente
   - Estado vazio orientador
   - Card do organization_id melhorado
6. ⏳ Atualizar docs/refactors.md
7. ⏳ Validar contraste AA/AAA
8. ⏳ Testar responsividade

## 📊 Métricas de Sucesso

### Antes
- Tipografia: 12-16px (ilegível)
- Botões: < 40pt (inacionável)
- Hierarquia: confusa (tudo igual)
- Organização: caótica (30+ cards)
- Nomes: técnicos (adicionarCliente)

### Depois
- Tipografia: ≥14pt corpo, ≥17pt títulos
- Botões: ≥44pt (acessível)
- Hierarquia: clara (featured + tabs)
- Organização: categorizada e progressiva
- Nomes: humanos (Criar Cliente)

## 🎯 Princípios Aplicados

### Clareza (HIG)
- Tipografia legível ≥14pt
- Hierarquia visual nítida
- Alvos de toque ≥44pt

### Deferência (HIG)
- Conteúdo como herói
- Interface em segundo plano
- Progressive disclosure

### Profundidade (HIG)
- Elevação com shadows
- Transições suaves 200ms
- Hover states comunicam interatividade

### Simplicidade (Ive)
- Featured nodes (não 30+ iguais)
- Um botão primário por card
- Remoção de badges técnicas inúteis

### Heurísticas (Nielsen)
- Status visível (badges semânticas)
- Estados vazios orientadores
- Feedback imediato ("Copiado!")
- Consistência visual

## 📝 Impacto Esperado

**Usuário vê 3 nodes essenciais** → escolhe um → copia em 10 segundos → sucesso

Não mais: "30 cards técnicos" → confusão → desiste

---

*Blueprint criado: 2025-11-03*  
*Status: Aprovado para implementação*  
*Próximo passo: Criar componentes modulares*

