# 🎯 Dados que Steve Jobs Coletaria no Onboarding — Tomik

## Filosofia Jobsiana: "Simplicidade é a sofisticação máxima"

Steve Jobs coletaria **apenas o essencial** para entregar **valor imediato** e **personalizar a experiência** desde o primeiro segundo.

---

## 🎯 1. Job to be Done (O que você quer fazer AGORA?)

**Pergunta única, múltipla escolha visual:**

```
"Qual é sua prioridade hoje?"

[Card 1] Criar meu primeiro agente de vendas
[Card 2] Conectar WhatsApp ao meu funil
[Card 3] Trazer meus dados (BYO) e começar
[Card 4] Ver como funciona (explorar)
```

**Por quê?**
- Entende o "job to be done" imediato
- Permite personalizar o próximo passo
- Reduz fricção — usuário já sabe o que quer
- Dados de produto: qual caso de uso é mais comum

**Como usar:**
- Se escolher "Criar agente" → Wizard direto de criação
- Se escolher "Conectar WhatsApp" → Fluxo de integração guiado
- Se escolher "BYO" → Onboarding de dados
- Se escolher "Explorar" → Tour interativo

---

## 👤 2. Persona/Role (Quem é você?)

**Pergunta única, múltipla escolha:**

```
"Qual melhor descreve seu papel?"

[CEO/Founder] Tomo decisões estratégicas
[Head de Vendas] Gerencio equipe comercial
[RevOps/Growth] Otimizo processos e métricas
[CS/Atendimento] Gerencio experiência do cliente
[Agência/Parceiro] Entrego soluções para clientes
[Automação/Tech] Integro sistemas e automações
```

**Por quê?**
- Personaliza mensagens e features mostradas
- Ajusta linguagem e profundidade técnica
- Mostra templates/receitas relevantes
- Permite criar "James" (agente interno) com contexto certo

**Como usar:**
- CEO → Mostra "James" e métricas executivas primeiro
- Head de Vendas → Foca em cadências, WhatsApp, funil
- RevOps → Destaca A/B, versionamento, métricas
- CS → Templates, SLAs, qualidade de resposta
- Agência → White-label, receitas replicáveis
- Tech → BYO, conectores, webhooks, n8n

---

## 🏢 3. Setor/Vertical (Contexto do negócio)

**Pergunta única, múltipla escolha:**

```
"Em qual setor você atua?"

[Saúde/Clínicas] Atendimento e agendamentos
[E-commerce/Varejo] Vendas e follow-up
[Serviços/B2B] Qualificação e relacionamento
[Educação] Captação e retenção
[Outro] Personalizado
```

**Por quê?**
- Mostra templates e receitas pré-configuradas
- Ajusta exemplos e casos de uso
- Personaliza "James" com conhecimento do setor
- Acelera time-to-value

**Como usar:**
- Saúde → Templates de agendamento, follow-up pós-consulta
- E-commerce → Abandono de carrinho, pós-venda
- B2B → Qualificação de leads, nurturing
- Educação → Captação, retenção de alunos

---

## 📊 4. Urgência/Ambiente (Como você quer começar?)

**Pergunta única, múltipla escolha:**

```
"Como prefere começar?"

[🚀 Produção] Quero começar a usar agora
[🧪 Teste] Quero experimentar primeiro
[📚 Aprender] Quero entender antes de usar
```

**Por quê?**
- Ajusta nível de assistência
- Define se mostra setup completo ou simplificado
- Personaliza onboarding (rápido vs guiado)
- Entende expectativa de tempo

**Como usar:**
- Produção → Setup completo, assistência ativa
- Teste → Ambiente sandbox, dados de exemplo
- Aprender → Tour, tutoriais, documentação

---

## 🎨 5. Preferência Visual (Tema)

**Mantém como está** — escolha visual de tema (light/dark)

**Por quê?**
- Experiência pessoal importante
- Não bloqueia progresso
- Pode ser mudado depois

---

## ❌ O que Jobs **NÃO** coletaria

### ❌ Informações demográficas genéricas
- Idade, gênero, localização (não agregam valor imediato)
- Coletar depois, se necessário para analytics

### ❌ Dados de empresa extensos
- CNPJ, endereço completo, telefone (coletar depois, quando necessário)
- Apenas nome da organização e slug (essencial para funcionar)

### ❌ Perguntas sobre budget/preço
- Não no primeiro momento — foca em valor primeiro
- Mostrar preços depois que usuário vê valor

### ❌ Formulários longos
- Jobs odiava formulários — "Se você precisa perguntar, você não entendeu"
- Coleta progressiva, conforme necessidade

---

## 🎯 Estrutura de Onboarding Jobsiano

### **Step 1: Bem-vindo + Job to be Done**
- Mensagem impactante (mantém atual)
- **Uma pergunta visual**: "Qual é sua prioridade hoje?"
- Cards grandes, visuais, fáceis de clicar

### **Step 2: Persona + Setor**
- **Duas perguntas rápidas**: Role e Setor
- Visual, cards, sem formulários

### **Step 3: Tema (Visual)**
- Mantém como está — escolha de tema

### **Step 4: Vídeo Final**
- Mantém vídeo "Onboarding Final.mp4"

### **Step 5: Ação Imediata**
- Baseado nas respostas:
  - Se "Criar agente" → Wizard de criação
  - Se "Conectar WhatsApp" → Fluxo de integração
  - Se "BYO" → Setup de dados
  - Se "Explorar" → Tour interativo

---

## 📊 Dados Coletados (Resumo)

| Dado | Por quê | Quando usar |
|------|---------|-------------|
| **Job to be Done** | Entender objetivo imediato | Personalizar próximo passo |
| **Persona/Role** | Personalizar experiência | Ajustar features, linguagem, templates |
| **Setor/Vertical** | Mostrar templates relevantes | Acelerar time-to-value |
| **Urgência/Ambiente** | Ajustar nível de assistência | Setup completo vs sandbox |
| **Tema** | Preferência visual | Experiência pessoal |
| **Nome Org + Slug** | Funcionalidade básica | Criar organização |

---

## 🚀 Implementação Recomendada

### Fase 1: Essencial (MVP)
1. ✅ Job to be Done (1 pergunta)
2. ✅ Persona/Role (1 pergunta)
3. ✅ Tema (já existe)
4. ✅ Vídeo final (já existe)

### Fase 2: Otimização
5. Setor/Vertical
6. Urgência/Ambiente

### Fase 3: Analytics
- Coletar dados de uso para validar hipóteses
- A/B testar perguntas
- Medir impacto no time-to-value

---

## 💡 Princípios Jobsianos Aplicados

1. **"Simplicidade é sofisticação"**
   - Máximo 3-4 perguntas
   - Visual, não textual
   - Progressivo, não tudo de uma vez

2. **"Foco no valor, não em dados"**
   - Cada pergunta deve melhorar a experiência
   - Se não melhora, não pergunta

3. **"Pense diferente"**
   - Não pergunte "quem você é" (demográfico)
   - Pergunte "o que você quer fazer" (comportamental)

4. **"Detalhes não são detalhes, são o design"**
   - Animações suaves
   - Feedback visual imediato
   - Transições mágicas

5. **"Stay hungry, stay foolish"**
   - Teste hipóteses
   - Meça impacto
   - Itere rápido

---

## 🎯 Resultado Esperado

**Antes:** Usuário escolhe tema → vê vídeo → cria organização → não sabe o que fazer

**Depois:** Usuário escolhe objetivo → vê experiência personalizada → já está criando primeiro agente/receita → valor imediato

**Métrica chave:** Reduzir time-to-first-value de horas para minutos.

