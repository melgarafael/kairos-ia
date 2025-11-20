# 🔷 Blueprint: Unificação de Side Panels - IA Console

## 📋 Objetivo

Refatorar a estrutura de side panels do IA Console para eliminar redundância visual e melhorar a experiência do usuário, mantendo todas as funcionalidades de forma mais integrada e elegante.

## 🎯 Problema Identificado

Atualmente existem **dois side panels**:

1. **Sidebar Esquerdo** (`components/layout/sidebar.tsx`)
   - Navegação global (Painel, IA Console, Segurança)
   - Fixo em todas as páginas admin
   - Propósito: Navegação principal

2. **Painel Direito** (`components/chat/chat-panel.tsx`)
   - Mostra "Execuções MCP" (logs de ferramentas)
   - Visível apenas na página de chat
   - Propósito: Feedback de execuções da IA

**Problema**: Dois painéis laterais competem por atenção e ocupam espaço horizontal valioso, especialmente em telas menores.

## 🎨 Solução Proposta

### Opção Escolhida: Painel Direito Colapsável

Transformar o painel direito em um componente **colapsável/expansível** que:
- Por padrão, mostra apenas um indicador discreto quando há execuções
- Pode ser expandido para ver detalhes completos
- Integra melhor com o fluxo do chat
- Mantém todas as funcionalidades existentes

### Estrutura Proposta

```
ChatPanel
├── Main Chat Area (flex-1)
│   ├── Messages
│   └── Input
└── MCP Executions Panel (colapsável)
    ├── Estado: collapsed/expanded
    ├── Badge com contador quando collapsed
    └── Lista completa quando expanded
```

## 📐 Mudanças Técnicas

### Arquivos Afetados

1. `components/chat/chat-panel.tsx`
   - Adicionar estado `isMcpPanelExpanded`
   - Transformar grid em flex com painel colapsável
   - Criar componente `McpExecutionsPanel` separado

2. `components/chat/mcp-executions-panel.tsx` (NOVO)
   - Componente modular para execuções MCP
   - Suporta estados collapsed/expanded
   - Animações suaves

### Benefícios

- ✅ Reduz competição visual entre painéis
- ✅ Mais espaço para o chat quando não necessário
- ✅ Mantém funcionalidade completa
- ✅ Melhor responsividade
- ✅ Segue princípio de "deferência ao conteúdo"

## 🔄 Fluxo de Dados

```
ChatPanel (estado: toolLogs)
    ↓
McpExecutionsPanel (props: toolLogs, isExpanded, onToggle)
    ↓
Renderiza lista ou badge conforme estado
```

## ✅ Critérios de Sucesso

1. Painel direito inicia colapsado por padrão
2. Badge mostra contador quando há execuções
3. Expansão/colapso funciona suavemente
4. Todas as execuções MCP continuam visíveis quando expandido
5. Layout responsivo mantido
6. Nenhuma funcionalidade perdida

## 🚫 Não Fazer

- Não remover o sidebar esquerdo (navegação global é necessária)
- Não remover funcionalidade de execuções MCP
- Não quebrar responsividade existente

## 📝 Notas de Implementação

- Usar `framer-motion` para animações suaves
- Manter tokens de design existentes
- Seguir padrão visual Apple/Jobsiano já estabelecido
- Componente deve ser testável isoladamente

---

**Status**: Aprovado para implementação
**Data**: 2025-01-27

