# 🎯 Refatoração Apple-like: Área de Prompts
## Design Crítico e Implementação

---

## 📋 **Análise Crítica (Com o olhar de Steve Jobs)**

### **O que estava ERRADO:**

#### 1. **Hierarquia Visual Fraca**
- **Problema:** Header genérico (10x10), título técnico "Prompts × n8n (Supabase BYO)" que parece jargão
- **Impacto:** Usuário não entende imediatamente o propósito da seção
- **Princípio violado:** Clareza (HIG)

#### 2. **Badges Minúsculas e Ilegíveis**
- **Problema:** text-[11px], ícones w-3 h-3, difícil de ler
- **Impacto:** As ferramentas são CRÍTICAS mas pareciam notas de rodapé
- **Princípio violado:** Legibilidade, Alvos de Toque (44pt)

#### 3. **Preview Quebrava o Fluxo**
- **Problema:** `<pre>` com scroll dentro do card, poluição visual
- **Impacto:** Ruído visual, usuário fica perdido entre preview e ação
- **Princípio violado:** Deferência (conteúdo deve ser herói)

#### 4. **Falta Contexto de Uso (JTBD)**
- **Problema:** Não havia "quando usar isso" ou "para que serve"
- **Impacto:** Usuário não sabe qual prompt escolher para seu caso
- **Princípio violado:** Jobs to be Done, Descobribilidade

#### 5. **Botões Pequenos Demais**
- **Problema:** px-2 py-1, text-xs, não atingem 44pt de alvo de toque
- **Impacto:** Dificulta uso em tablet, vai contra guidelines iOS
- **Princípio violado:** Alvos de Toque & Espaçamento (HIG)

#### 6. **Falta Profundidade**
- **Problema:** Design flat, sem camadas, sem convite ao toque
- **Impacto:** Cards não parecem interativos
- **Princípio violado:** Profundidade (HIG)

---

## ✅ **O que foi IMPLEMENTADO**

### **1. Header Reestruturado (Clareza)**
```tsx
<div className="w-14 h-14 gradient-primary rounded-2xl glow-primary shadow-lg">
  <Bot className="w-7 h-7 text-white" />
</div>
<h3 className="text-3xl font-bold tracking-tight">Prompts para Agentes</h3>
<p className="text-[17px] text-muted-foreground leading-relaxed">
  Ensine sua IA a trabalhar com as ferramentas do Tomik CRM
</p>
```
**Mudanças:**
- Ícone aumentado de 10x10 para 14x14 (56px)
- Título de "font-semibold" para text-3xl (32px) bold
- Descrição de text-xs para text-[17px] (Apple padrão para body)
- Linguagem humanizada: não é "Prompts × n8n (Supabase BYO)", é "Ensine sua IA"

---

### **2. Hero Section Educativa**
```tsx
<div className="w-16 h-16 gradient-primary rounded-2xl glow-primary shadow-xl">
  <Sparkles className="w-8 h-8" />
</div>
<h4 className="text-[24px] font-bold">Como usar esses prompts?</h4>
<p className="text-[15px] max-w-2xl">
  Cada prompt contém instruções completas sobre como usar as ferramentas do Supabase. 
  Copie e cole no System Message do seu agente ou dentro de um node de IA no n8n.
</p>
```
**Por quê:**
- Guidance imediata (Descobribilidade - Tog)
- Reduz fricção: usuário sabe O QUE fazer antes de escolher
- Progressive Disclosure: informação de contexto antes da ação

---

### **3. Cards Redesenhados (Clareza + Profundidade + Deferência)**

#### **Estrutura do Card:**
```tsx
// Ícone Grande com Gradiente Colorido
<div className="w-14 h-14 rounded-2xl bg-gradient-to-br ${iconColor} shadow-lg">
  <Icon className="w-7 h-7 text-white" />
</div>

// Título e Subtítulo (não mais jargão técnico)
<h3 className="text-[20px] font-bold group-hover:text-primary">
  Gestão de Leads  // antes: "CRM BYO Supabase (Leads)"
</h3>
<p className="text-[15px] text-muted-foreground">
  Ensine sua IA a capturar e gerenciar oportunidades
</p>
```

**Mudanças:**
- Ícones específicos por módulo (Target, DollarSign, CreditCard, Calendar)
- Gradientes coloridos distintos (purple/fuchsia, green/emerald, red/orange, blue/cyan)
- Títulos humanizados focados no JOB, não na tecnologia
- Subtítulos explicam o BENEFÍCIO, não a implementação

---

### **4. Jobs to be Done (JTBD) - Descobribilidade**

Adicionado seção "Use quando precisar":
```tsx
<div className="space-y-2">
  <div className="text-[13px] font-semibold uppercase tracking-wide">
    Use quando precisar:
  </div>
  <div className="space-y-1.5">
    <div className="flex items-center gap-2 text-[14px]">
      <ArrowRight className="w-4 h-4 text-primary" />
      <span>Capturar leads do WhatsApp</span>
    </div>
    <div className="flex items-center gap-2 text-[14px]">
      <ArrowRight className="w-4 h-4 text-primary" />
      <span>Qualificar automaticamente</span>
    </div>
    <div className="flex items-center gap-2 text-[14px]">
      <ArrowRight className="w-4 h-4 text-primary" />
      <span>Atualizar estágios do funil</span>
    </div>
  </div>
</div>
```

**Por quê:**
- Usuário escolhe por OBJETIVO, não por nome técnico
- Alinhado com princípio JTBD do documento DESIGN-APPLE.md
- Reduz carga cognitiva (Nielsen: Recognition over Recall)

---

### **5. Progressive Disclosure - Ferramentas**

Ferramentas agora em `<details>`:
```tsx
<details className="space-y-3">
  <summary className="text-[13px] font-medium cursor-pointer flex items-center gap-2">
    <Database className="w-4 h-4" />
    7 ferramentas incluídas
  </summary>
  <div className="flex flex-wrap gap-2 pt-2">
    {section.tools.map(t => (
      <ToolBadge key={t} name={t} />
    ))}
  </div>
</details>
```

**Mudanças no Badge:**
- De text-[11px] para text-[13px]
- De px-2 py-0.5 para px-3 py-1.5
- Ícone de w-3 h-3 para w-3.5 h-3.5
- Cor: de border com text-muted para bg-accent/60 com text-foreground

**Por quê:**
- Progressive Disclosure: detalhes técnicos só quando solicitados
- Badges legíveis (14px é mínimo recomendado pela Apple)
- Reduz poluição visual inicial

---

### **6. Footer com Ações Claras (Alvos de Toque)**

```tsx
<div className="border-t px-6 py-4 flex items-center justify-between">
  <Button variant="ghost" size="sm" className="text-[14px]">
    <Maximize2 className="w-4 h-4 mr-2" />
    Ver Conteúdo
  </Button>
  <Button variant="magic" size="default" className="h-11 px-6 text-[15px]">
    {copied ? (
      <><Check className="w-4 h-4 mr-2" />Copiado!</>
    ) : (
      <><Copy className="w-4 h-4 mr-2" />Copiar Prompt</>
    )}
  </Button>
</div>
```

**Mudanças:**
- Botão primário agora h-11 (44pt) com px-6 e text-[15px]
- Ação secundária ("Ver Conteúdo") visualmente discreta mas acessível
- Estados claros (Copiado! com Check icon)
- Respeitam 44×44pt de alvo de toque (HIG)

---

### **7. Modal Redesenhado**

```tsx
<Modal title={section.title} subtitle={section.subtitle} size="xl">
  <div className="space-y-4">
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br ${iconColor} shadow-md">
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="text-[14px]">
          {section.tools.length} ferramentas disponíveis
        </div>
      </div>
      <Button variant="magic" className="h-10 px-5 text-[14px]">
        Copiar Prompt
      </Button>
    </div>

    <div className="border rounded-2xl overflow-hidden">
      <div className="max-h-[60vh] overflow-auto">
        <pre className="text-[13px] p-6 leading-relaxed">{content}</pre>
      </div>
    </div>

    <div className="text-[13px] bg-accent/30 rounded-xl p-4">
      <strong>💡 Dica:</strong> Cole este prompt no n8n dentro de um node 
      de IA (OpenAI, Anthropic, etc) ou use como System Message do seu agente.
    </div>
  </div>
</Modal>
```

**Mudanças:**
- Removido preview com scroll dentro do card (ruído visual)
- Modal agora mostra conteúdo completo em tamanho legível (13px)
- Dica de uso no final (guidance contextual)
- Ação principal (Copiar) destacada no topo

---

## 🎨 **Design Tokens Aplicados**

### **Tipografia (SF/Inter scale)**
| Elemento | Antes | Depois | Justificativa |
|----------|-------|--------|---------------|
| Header título | font-semibold | text-3xl (32px) | HIG: SF Display ≥20pt |
| Header descrição | text-xs | text-[17px] | Apple padrão para body |
| Card título | text-sm | text-[20px] | Destaque, legibilidade |
| Card subtítulo | text-xs | text-[15px] | Mínimo 14pt para corpo |
| Badges | 11px | 13px | Legibilidade, acessibilidade |
| Botão primário | text-xs | text-[15px] | Clareza, affordance |

### **Espaçamento (8pt grid)**
| Elemento | Antes | Depois |
|----------|-------|--------|
| Card padding | p-4 | p-6 (48px) |
| Badge padding | px-2 py-0.5 | px-3 py-1.5 |
| Botão altura | — | h-11 (44pt) ✅ |
| Gap entre cards | gap-4 | gap-6 |

### **Cores & Profundidade**
- **Gradientes distintos por módulo:**
  - Leads: `from-purple-500 to-fuchsia-500`
  - Receitas: `from-green-500 to-emerald-500`
  - Despesas: `from-red-500 to-orange-500`
  - Agenda: `from-blue-500 to-cyan-500`
- **Sombras adicionadas:** `shadow-lg`, `shadow-xl` para criar profundidade
- **Hover states:** `hover:border-primary/30 hover:shadow-xl group-hover:text-primary`

---

## 📊 **Princípios Apple Aplicados**

### ✅ **1. Clareza (HIG)**
- Tipografia legível (≥14pt corpo, ≥20pt títulos)
- Hierarquia visual nítida (ícones grandes, títulos bold)
- Controles inequívocos (botões claros, estados distintos)

### ✅ **2. Deferência (HIG)**
- Preview removido: conteúdo não compete com ações
- Progressive Disclosure: ferramentas técnicas em `<details>`
- Interface fica em segundo plano, JOBS do usuário são o herói

### ✅ **3. Profundidade (HIG)**
- Camadas com sombras (`shadow-lg`, `shadow-xl`)
- Transições suaves (`transition-all duration-200`)
- Hover states comunicam interatividade

### ✅ **4. Simplicidade Verdadeira (Ive)**
- Removido ruído: preview com scroll, badges poluídos
- Cada elemento tem propósito claro
- "Reduzir e reduzir" sem perder utilidade

### ✅ **5. Bom Design (Rams)**
- **Útil:** JTBD mostra QUANDO usar cada prompt
- **Compreensível:** linguagem humanizada, não jargão
- **Discreto:** ferramentas técnicas em disclosure
- **Honesto:** não esconde complexidade, mas a organiza

### ✅ **6. Heurísticas de Nielsen**
- **Status visível:** "Copiado!" com feedback imediato
- **Reconhecer > Recordar:** casos de uso listados explicitamente
- **Consistência:** padrão visual alinhado com AIAgents e Webhooks

### ✅ **7. Primeiros Princípios (Tog)**
- **Descobribilidade:** hero section explica uso antes da escolha
- **Simplicidade:** 1 card = 1 módulo claro
- **Feedback imediato:** toast + ícone de check ao copiar

### ✅ **8. Alvos de Toque (44×44pt)**
- Botão primário: `h-11` (44pt) ✅
- Badges: `px-3 py-1.5` (touch-friendly)
- Espaçamento entre elementos: ≥8pt

---

## 📁 **Arquivos Modificados**

### `src/components/features/Automation/AutomationPrompts.tsx`
**Linhas mudadas:** ~325 (refatoração completa)

**Principais mudanças:**
1. Type `PromptSection` expandido com `icon`, `iconColor`, `subtitle`, `useCases`
2. Array `SECTIONS` reescrito com linguagem JTBD
3. Componente `ToolBadge` redesenhado (13px, maior padding)
4. Componente `PromptCard` completamente refatorado:
   - Header com ícone 14x14 e gradiente
   - Seção JTBD ("Use quando precisar")
   - Progressive Disclosure para ferramentas
   - Footer com ações claras (44pt)
5. Componente principal com header Apple-like + hero section
6. Grid mudado de 3 colunas (xl) para 2 colunas (md)

---

## 🎯 **Próximos Passos Sugeridos**

### **1. Testar Acessibilidade**
- [ ] Verificar contraste WCAG AA (≥4.5:1) em todos os textos
- [ ] Testar navegação por teclado (Tab, Enter)
- [ ] Validar `aria-label` nos botões

### **2. Testes de Usabilidade**
- [ ] Observar usuários escolhendo prompts (facilidade de escolha?)
- [ ] Medir tempo até primeira cópia bem-sucedida
- [ ] Validar se JTBD reduz dúvidas

### **3. Melhorias Futuras**
- [ ] Busca por caso de uso ("como capturar leads do WhatsApp")
- [ ] Filtros por módulo (Leads, Financeiro, Agenda)
- [ ] Preview de como o prompt funciona (vídeo curto ou GIF)
- [ ] Histórico de prompts copiados

### **4. Documentação Técnica**
- [ ] Adicionar comentários JSDoc nos tipos
- [ ] Criar Storybook stories para PromptCard
- [ ] Documentar padrão de JTBD para novos prompts

---

## 💬 **Citação Final (Steve Jobs)**

> "Design is not just what it looks like and feels like. Design is how it works."

Antes, a área de Prompts **parecia funcional** mas não **trabalhava pelo usuário**. 

Agora:
- O usuário **encontra** o que precisa (JTBD)
- **Entende** imediatamente o que faz (clareza)
- **Age** sem fricção (alvos de toque, botões claros)
- **Confia** no sistema (profundidade, feedback)

**Isso é design que funciona.**

---

**Data:** 2025-01-03  
**Autor:** AI Assistant (Claude Sonnet 4.5)  
**Princípios Aplicados:** DESIGN-APPLE.md, tomik-coding-doctrine.md

