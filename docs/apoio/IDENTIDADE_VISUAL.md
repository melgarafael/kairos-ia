# 🎨 Especificações de Identidade Visual - Tomik AI GPTs

## 📋 Sumário
- [Visão Geral](#visão-geral)
- [Sistema de Temas](#sistema-de-temas)
- [Paleta de Cores](#paleta-de-cores)
- [Tipografia](#tipografia)
- [Sistema de Espaçamento](#sistema-de-espaçamento)
- [Bordas e Cantos](#bordas-e-cantos)
- [Sombras](#sombras)
- [Animações e Transições](#animações-e-transições)
- [Ícones](#ícones)
- [Componentes Base](#componentes-base)
- [Padrões de Background](#padrões-de-background)
- [Responsividade](#responsividade)

--- 

## 🎯 Visão Geral

### Stack de Design
- **Framework UI**: shadcn/ui
- **Sistema de Temas**: next-themes
- **Estilização**: Tailwind CSS
- **Abordagem**: Dark-first com suporte completo para light mode
- **Metodologia**: Design System baseado em tokens CSS customizáveis

### Princípios de Design
1. **Consistência**: Uso de variáveis CSS para manter consistência visual
2. **Acessibilidade**: Contraste adequado e suporte a preferências do sistema
3. **Performance**: Animações otimizadas e transições suaves
4. **Modularidade**: Componentes reutilizáveis e extensíveis

---

## 🌓 Sistema de Temas

### Configuração Base
```typescript
// Configuração do Provider de Temas
<ThemeProvider
  attribute="class"
  defaultTheme="dark"
  enableSystem={false}
  storageKey="tomikai-theme"
>
```

### Toggle de Tema
- **Ícones**: Moon (dark) / Sun (light) da biblioteca Lucide React
- **Labels**: "Modo Escuro" / "Modo Claro" (PT-BR)
- **Implementação**: Class-based com Tailwind CSS

---

## 🎨 Paleta de Cores

### Sistema de Cores Principal (HSL)

#### Modo Claro (Light)
```css
--background: 0 0% 100%;        /* #FFFFFF - Branco puro */
--foreground: 0 0% 3.9%;        /* #0A0A0A - Quase preto */
--primary: 0 0% 9%;             /* #171717 - Cinza muito escuro */
--primary-foreground: 0 0% 98%; /* #FAFAFA - Quase branco */
--secondary: 0 0% 96.1%;        /* #F5F5F5 - Cinza muito claro */
--secondary-foreground: 0 0% 9%; /* #171717 */
--accent: 0 0% 96.1%;           /* #F5F5F5 - Cinza claro */
--accent-foreground: 0 0% 9%;   /* #171717 */
--destructive: 0 84.2% 60.2%;   /* #EF4444 - Vermelho */
--border: 0 0% 89.8%;           /* #E5E5E5 - Cinza claro */
--ring: 0 0% 3.9%;              /* #0A0A0A */
--muted: 0 0% 96.1%;            /* #F5F5F5 */
--muted-foreground: 0 0% 45.1%; /* #737373 */
```

#### Modo Escuro (Dark)
```css
--background: 0 0% 12%;          /* #1F1F1F - Cinza muito escuro */
--foreground: 0 0% 98%;          /* #FAFAFA - Quase branco */
--primary: 0 0% 98%;             /* #FAFAFA */
--primary-foreground: 0 0% 9%;  /* #171717 */
--secondary: 0 0% 14.9%;        /* #262626 - Cinza escuro */
--secondary-foreground: 0 0% 98%; /* #FAFAFA */
--accent: 0 0% 14.9%;           /* #262626 */
--accent-foreground: 0 0% 98%;  /* #FAFAFA */
--destructive: 0 62.8% 30.6%;   /* #7F1D1D - Vermelho escuro */
--border: 0 0% 14.9%;           /* #262626 */
--ring: 0 0% 83.1%;             /* #D4D4D4 */
--muted: 0 0% 14.9%;            /* #262626 */
--muted-foreground: 0 0% 63.9%; /* #A3A3A3 */
```

### Cores da Sidebar
```css
/* Light Mode */
--sidebar-background: 0 0% 98%;        /* #FAFAFA */
--sidebar-foreground: 240 5.3% 26.1%;  /* #3F3F46 */
--sidebar-primary: 224.3 76.3% 48%;    /* #2563EB - Azul */
--sidebar-accent: 0 0% 94.1%;          /* #F0F0F0 */
--sidebar-border: 220 13% 91%;         /* #E2E8F0 */

/* Dark Mode */
--sidebar-background: 0 0% 9%;         /* #171717 */
--sidebar-foreground: 240 4.8% 95.9%;  /* #F4F4F5 */
--sidebar-primary: 224.3 76.3% 48%;    /* #2563EB */
--sidebar-accent: 240 3.7% 15.9%;      /* #27272A */
--sidebar-border: 240 3.7% 15.9%;      /* #27272A */
```

### Cores de Gráficos
```css
--chart-1: 12 76% 61%;   /* Light: #EA8C55 */
--chart-2: 173 58% 39%;  /* Light: #2BA59F */
--chart-3: 197 37% 24%;  /* Light: #27495F */
--chart-4: 43 74% 66%;   /* Light: #E9D758 */
--chart-5: 27 87% 67%;   /* Light: #F4B942 */

/* Dark Mode */
--chart-1: 220 70% 50%;  /* #3B82F6 */
--chart-2: 160 60% 45%;  /* #10B981 */
--chart-3: 30 80% 55%;   /* #F59E0B */
--chart-4: 280 65% 60%;  /* #9333EA */
--chart-5: 340 75% 55%;  /* #EC4899 */
```

### Cores de Badges de Plataforma
- **Orange**: `bg-orange-100/50` (light) / `bg-orange-900/20` (dark)
- **Purple**: `bg-purple-100/50` (light) / `bg-purple-900/20` (dark)
- **Rose**: `bg-rose-100/50` (light) / `bg-rose-900/20` (dark)
- **Green**: `bg-green-100/50` (light) / `bg-green-900/20` (dark)
- **Blue**: `bg-blue-100/50` (light) / `bg-blue-900/20` (dark)
- **Gray**: `bg-gray-100/50` (light) / `bg-gray-900/20` (dark)

---

## ✏️ Tipografia

### Fontes
```typescript
// Fonte Principal
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'] })

// Fonte Monospace (código)
font-family: var(--font-mono);
```

### Escala Tipográfica

#### Títulos
- **H1 Card**: `text-2xl font-semibold leading-none tracking-tight`
- **H2 Section**: `text-xl font-semibold`
- **H3 Subsection**: `text-lg font-medium`

#### Texto do Corpo
- **Parágrafo**: `text-base` (16px)
- **Descrição**: `text-sm text-muted-foreground` (14px)
- **Small**: `text-xs` (12px)

#### Elementos Especiais
- **Botão**: `text-sm font-medium` (14px, peso médio)
- **Badge**: `text-xs font-semibold` (12px, peso semi-bold)
- **Category Badge Mobile**: `text-[9px] font-medium`
- **Category Badge Desktop**: `text-[10px] font-medium`
- **Código**: `fontSize: 0.875rem, lineHeight: 1.5`

---

## 📐 Sistema de Espaçamento

### Espaçamento Customizado
```javascript
spacing: {
  '90': '22.5rem' // 360px - largura customizada
}
```

### Padrões de Padding
- **Card Header**: `p-6` (24px)
- **Card Content**: `p-6 pt-0` (24px lateral, 0 topo)
- **Button Small**: `px-3` (12px horizontal)
- **Button Default**: `px-4 py-2` (16px/8px)
- **Badge**: `px-2.5 py-0.5` (10px/2px)

---

## 🔲 Bordas e Cantos

### Sistema de Border Radius
```css
--radius: 0.5rem; /* 8px - base */
```

### Valores Aplicados
- **Large**: `rounded-lg` (--radius = 8px)
- **Medium**: `rounded-md` (--radius - 2px = 6px)
- **Small**: `rounded-sm` (--radius - 4px = 4px)
- **Full**: `rounded-full` (badges, avatares)

### Bordas
- **Default**: `border` (1px solid)
- **Cor**: Usa variável `--border` do tema

---

## 🌑 Sombras

### Classes de Sombra
- **Subtle**: `shadow-sm` - Cards e elementos UI básicos
- **Medium**: `shadow-md` - Elementos elevados
- **Large**: `shadow-lg` - Modais e diálogos
- **Extra Large**: `shadow-2xl` - Welcome survey dialog
- **Drop**: `drop-shadow-md` - Imagens e elementos especiais

---

## ⚡ Animações e Transições

### Animações Customizadas

#### Accordion
```css
@keyframes accordion-down {
  from { height: 0; }
  to { height: var(--radix-accordion-content-height); }
}
/* Duração: 0.2s ease-out */

@keyframes accordion-up {
  from { height: var(--radix-accordion-content-height); }
  to { height: 0; }
}
/* Duração: 0.2s ease-out */
```

#### Fade In
```css
@keyframes fade-in {
  from { opacity: 0.5; }
  to { opacity: 1; }
}
/* Duração: 0.3s ease-in-out */
```

### Animações Nativas
- **Pulse**: `animate-pulse` - Backgrounds animados
- **Hover Scale**: `hover:scale-[1.02]` - Efeito sutil de hover
- **Transitions**: 
  - `transition-colors` - Mudanças de cor
  - `transition-all duration-200` - Transições gerais

---

## 🎭 Ícones

### Bibliotecas de Ícones
1. **Lucide React** - Biblioteca principal
2. **Radix UI Icons** - Componentes UI específicos

### Ícones de Provedores (com variantes light/dark)
- Anthropic (Claude)
- OpenAI
- Google
- Perplexity
- XAI
- N8N

### Tamanhos Padrão
- **Small**: `h-4 w-4` (16px)
- **Default**: `h-5 w-5` (20px)
- **Large**: `h-6 w-6` (24px)

---

## 🧩 Componentes Base

### Cards
```css
/* Estrutura Base */
.card {
  rounded-lg
  border
  bg-card
  text-card-foreground
  shadow-sm
}

/* Header */
.card-header {
  p-6
}

/* Content */
.card-content {
  p-6 pt-0
}
```

### Botões
```css
/* Tamanhos */
.btn-sm { height: 36px; }
.btn-default { height: 40px; }
.btn-lg { height: 44px; }
.btn-icon { height: 40px; width: 40px; }

/* Estilos Base */
.btn {
  rounded-md
  text-sm
  font-medium
  transition-colors
  focus-visible:outline-none
  focus-visible:ring-2
}
```

### Badges
```css
.badge {
  rounded-full
  border
  px-2.5
  py-0.5
  text-xs
  font-semibold
  transition-colors
  focus:outline-none
  focus:ring-2
}
```

---

## 🌈 Padrões de Background

### Animated Background
```typescript
// Gradiente Pulsante
from-gray-50/30 via-transparent to-gray-100/30

// Overlay com padrão de pontos
background-image: radial-gradient(...)
```

### Wavy Background
```typescript
// Configuração
{
  colors: ["#38bdf8", "#818cf8", "#c084fc", "#e879f9", "#22d3ee"],
  blur: 10,
  speed: 0.001 // slow
}
```

---

## 📱 Responsividade

### Breakpoints (Tailwind padrão)
- **sm**: 640px
- **md**: 768px
- **lg**: 1024px
- **xl**: 1280px
- **2xl**: 1536px

### Padrões Responsivos
- Mobile-first approach
- Typography scaling responsivo
- Sidebar adaptável para mobile
- Badge sizing dinâmico baseado em tela

---

## 🎨 Tema de Syntax Highlighting

### Configuração de Código
```javascript
{
  fontFamily: 'var(--font-mono)',
  fontSize: '0.875rem',
  lineHeight: '1.5',
  
  // Cores
  base: '#e3e2e6',
  comment: '#6c7086', // italic
  keyword: '#cba6f7', // roxo
  string: '#a6e3a1',  // verde
  number: '#fab387',  // laranja
  function: '#89b4fa', // azul
  class: '#f9e2af'    // amarelo
}
```

---

## 🚀 Implementação Recomendada

### 1. Estrutura de Arquivos
```
/styles
  /globals.css     # Variáveis CSS e estilos globais
  /themes          # Configurações de tema
/components
  /ui              # Componentes base (shadcn)
  /shared          # Componentes compartilhados
/lib
  /utils.ts        # Utilidades (cn function)
```

### 2. Configuração Tailwind
```javascript
// tailwind.config.js
{
  darkMode: ['class'],
  theme: {
    extend: {
      colors: { /* usar CSS variables */ },
      borderRadius: { /* valores customizados */ },
      fontFamily: { /* fontes do projeto */ },
      keyframes: { /* animações customizadas */ }
    }
  }
}
```

### 3. Provider de Tema
```tsx
// Wrapper principal da aplicação
<ThemeProvider
  attribute="class"
  defaultTheme="dark"
  storageKey="seu-app-theme"
>
  {children}
</ThemeProvider>
```

---

## 📝 Notas de Implementação

### Boas Práticas
1. **Sempre use variáveis CSS** para cores do tema
2. **Prefira classes utilitárias** do Tailwind sobre CSS customizado
3. **Mantenha consistência** nos tamanhos e espaçamentos
4. **Teste em ambos os temas** (light/dark)
5. **Otimize animações** para performance

### Ferramentas Recomendadas
- **shadcn/ui CLI** para adicionar componentes
- **Tailwind CSS IntelliSense** para autocompletar
- **Theme Toggle** implementado e testado
- **CSS Variables** para customização dinâmica

---

## 🔄 Versionamento

**Versão**: 1.0.0
**Data**: Janeiro 2025
**Mantido por**: Equipe Tomik AI

---

*Esta documentação serve como guia completo para replicar a identidade visual em outros projetos da Tomik AI.*