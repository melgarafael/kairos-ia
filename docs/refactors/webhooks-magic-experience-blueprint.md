# 🪄 Blueprint: Transformação Mágica da Área de Webhooks

> *"A tecnologia deve desaparecer para que a magia apareça."* — Visão Steve Jobs para Tomik

---

## 📋 Objetivo

Transformar a área de webhooks de um painel técnico denso em uma experiência poética, intuitiva e visualmente envolvente — onde integrar sistemas pareça natural, mágico e inevitável.

---

## 🎯 Filosofia Base

### Antes (Técnico)
- Nome: "Webhooks"
- Linguagem: Jargões técnicos (endpoint, payload, retry)
- Visual: Tabelas, formulários densos, métricas frias
- Experiência: Configuração complexa, múltiplos campos técnicos

### Depois (Mágico)
- Nome: **"Conexões Vivas"** ou **"Fluxos Vivos"**
- Linguagem: Poética e humana ("Quando algo acontecer...", "Envie para...")
- Visual: Cards flutuantes, fluxos de energia pulsantes, espaços respiráveis
- Experiência: Wizard narrativo em etapas, feedback visual imediato

---

## 🏗️ Arquitetura da Transformação

### 1. Renomeação de Conceitos

| Técnico | Poético |
|---------|---------|
| Webhook | Conexão Viva / Ponte |
| Event Type | Momento / Respiração |
| Endpoint URL | Destino / Para onde enviar |
| Payload | Informações / Mensagem |
| Retry | Tentar novamente |
| Timeout | Tempo de espera |
| Rate Limit | Ritmo |

### 2. Estrutura de Componentes

```
src/components/features/Automation/
├── ConnectionsVivas/
│   ├── ConnectionsVivas.tsx          # Componente principal (substitui WebhookConfigurationPanel)
│   ├── ConnectionCard.tsx            # Card de conexão com animação de pulso
│   ├── ConnectionWizard.tsx          # Wizard narrativo de criação
│   ├── EnergyFlow.tsx                # Visualização de fluxo de energia
│   ├── ConnectionStatus.tsx          # Status visual com pulso
│   └── EventSelector.tsx             # Seletor de eventos com linguagem natural
```

### 3. Fluxo de Criação Simplificado

**Etapa 1: "Quando algo acontecer no Tomik..."**
- Dropdown com eventos em linguagem natural
- Exemplo: "Novo lead criado", "Negócio fechado", "Cliente atualizado"

**Etapa 2: "Envie essas informações para..."**
- Campo para URL ou seleção visual de integração (n8n, Zapier, Manychat)
- Preview visual do destino

**Etapa 3: "O que você quer enviar?"**
- UI visual de campos arrastáveis (estilo Shortcuts da Apple)
- Preview do que será enviado

**Etapa 4: "Pronto. A Tomik agora fala com [app]."**
- Confirmação com animação de fluxo de energia
- Visualização da conexão ativa

---

## 🎨 Design Visual

### Paleta e Estética

- **Fundo**: Translúcido em vidro líquido (`rgba(255,255,255,0.06)` com `backdrop-filter: blur(20px)`)
- **Cards**: Flutuantes, leves, com micro-glow
- **Ícones**: Minimalistas, monocromáticos, com luz direcional sutil
- **Tipografia**: Inter/SF Pro Rounded, line-height ampla
- **Animações**: Fade + scale (0.98 → 1.0), easing natural

### Estados Visuais

- **Ativo**: Brilho azul-púrpura leve (vibração energética)
- **Inativo**: Cinza translúcido
- **Pulsação**: Animação de fluxo de energia quando evento é disparado
- **Hover**: Leve elevação com sombra colorida

### Espaço Negativo

- Cards respiram (padding generoso)
- Nada polui a interface
- Hierarquia visual clara

---

## ⚡ Microdetalhes e Magia

### Animações

1. **Criação de Conexão**
   - Som suave (gota d'água) ao criar
   - Animação de fluxo de energia conectando Tomik → Destino

2. **Evento Disparado**
   - Linha de conexão acende com fluxo de luz animado
   - Pulsação sutil no card da conexão
   - Toast não intrusivo

3. **Hover e Interação**
   - Leve elevação com sombra colorida
   - Transições com easing natural (`cubic-bezier(0.4, 0, 0.2, 1)`)

### Feedback Visual

- **Sucesso**: Verde suave com pulso
- **Erro**: Vermelho suave com mensagem emocional ("A conexão parece instável. Vamos tentar de novo?")
- **Carregamento**: Skeleton com animação de respiração

---

## 🔌 Visualização de Fluxo

### Componente EnergyFlow

Visualização do fluxo de dados em tempo real:

```
[Tomik CRM] ⚡→ [n8n Flow]

Fluxo: Novo Lead → Enviar dados → Automação iniciada
```

- Linha pulsante conectando origem e destino
- Partículas de energia fluindo quando ativo
- Status visual com cores (verde = ativo, cinza = inativo)

---

## 📝 Mudanças Técnicas

### Mantido (Backend)
- Estrutura de dados (`webhook_configurations`, `webhook_events`)
- Hook `useWebhookConfigurations`
- Edge functions e processamento

### Refatorado (Frontend)
- Componente principal renomeado e redesenhado
- Linguagem de UI completamente revisada
- Wizard de criação simplificado
- Visualizações novas (EnergyFlow, ConnectionStatus)

### Compatibilidade
- Backend continua funcionando com nomenclatura técnica
- Frontend traduz para linguagem poética
- Migração suave sem quebrar funcionalidades

---

## 🚀 Plano de Implementação

### Fase 1: Estrutura Base
1. Criar pasta `ConnectionsVivas/`
2. Criar componente principal `ConnectionsVivas.tsx`
3. Migrar lógica de `WebhookConfigurationPanel.tsx`

### Fase 2: Wizard Narrativo
1. Criar `ConnectionWizard.tsx` com 4 etapas
2. Implementar seletor de eventos com linguagem natural
3. Adicionar preview visual

### Fase 3: Visualizações Mágicas
1. Criar `EnergyFlow.tsx` (fluxo de energia)
2. Criar `ConnectionCard.tsx` (card com pulso)
3. Implementar animações CSS

### Fase 4: Microdetalhes
1. Adicionar sons sutis (opcional)
2. Implementar feedback visual imediato
3. Polir transições e animações

### Fase 5: Documentação
1. Atualizar docs com nova nomenclatura
2. Criar guia de uso poético
3. Registrar mudanças em `refactors.md`

---

## ✅ Critérios de Sucesso

- [ ] Usuário consegue criar conexão em < 2 minutos
- [ ] Interface não assusta usuários não-técnicos
- [ ] Visualização de fluxo é intuitiva e mágica
- [ ] Feedback visual é imediato e claro
- [ ] Experiência transmite "magia" e não "técnica"
- [ ] Compatibilidade mantida com backend existente

---

## 📚 Referências

- Design System: `docs/apoio/IDENTIDADE_VISUAL.md`
- Princípios Apple: `docs/apoio/DESIGN-APPLE.md`
- Doutrina de Código: `docs/apoio/doutrina/tomik-coding-doctrine.md`

---

**Versão**: 1.0  
**Data**: Janeiro 2025  
**Status**: Aprovado para implementação

