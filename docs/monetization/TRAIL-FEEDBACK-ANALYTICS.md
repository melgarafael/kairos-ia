# Analytics de Feedback da Trilha de Monetização

## Visão Geral

Sistema Jobsiano de análise de feedbacks da trilha de monetização. Foco em **métricas que importam**, não em dashboards cheios de gráficos inúteis.

## Mudanças Implementadas

### Frontend (Jobsian Redesign)

**Antes:**
- 6 perguntas separadas
- 3 textareas diferentes
- Pergunta redundante sobre bônus
- Botão "Cancelar" desnecessário
- Grid quebrado e inconsistente

**Depois:**
- 3 perguntas essenciais
- 1 campo de feedback consolidado
- Bônus concedido automaticamente
- Apenas botão X para fechar
- Layout linear e claro

### Backend Integration

**Função RPC:** `monetization_feedback_submit`

A função RPC já faz tudo:
1. Salva o feedback na tabela
2. Concede bônus automaticamente se `completed = true` e `bonus_requested = true`
3. Valida e normaliza dados
4. Trata casos edge (org_id NULL, etc)

**Estrutura de Dados:**
```sql
monetization_trail_feedbacks (
  id uuid,
  user_id uuid,
  organization_id uuid,
  completed_first_agent boolean,
  guided_impl_rating int (1-5),
  main_difficulties text,
  liked_most text,
  suggestions text, -- Campo principal consolidado
  bonus_requested boolean,
  bonus_granted boolean,
  bonus_granted_at timestamptz,
  created_at timestamptz
)
```

**Compatibilidade:**
- Campo `suggestions` usado como campo principal consolidado
- Campos `main_difficulties` e `liked_most` mantidos para compatibilidade retroativa
- Frontend consolida tudo em `suggestions` mas também salva nos campos antigos

## Endpoint de Analytics

### `trail_feedback_analytics`

**URL:** `/admin-analytics?action=trail_feedback_analytics`

**Resposta:**
```json
{
  "summary": {
    "total": 150,
    "completed": 120,
    "completionRate": 80.0,
    "avgRating": 4.2,
    "bonusGranted": 115,
    "bonusRate": 76.67,
    "withTextFeedback": 90,
    "textFeedbackRate": 60.0
  },
  "ratingDistribution": [
    { "rating": 1, "label": "Péssimo", "count": 2, "percentage": 1.33 },
    { "rating": 2, "label": "Ruim", "count": 5, "percentage": 3.33 },
    { "rating": 3, "label": "Ok", "count": 20, "percentage": 13.33 },
    { "rating": 4, "label": "Bom", "count": 50, "percentage": 33.33 },
    { "rating": 5, "label": "Excelente", "count": 73, "percentage": 48.67 }
  ],
  "dailySeries": [
    {
      "date": "2025-01-15",
      "total": 10,
      "completed": 8,
      "completionRate": 80.0,
      "avgRating": 4.5
    }
  ],
  "recentFeedbacks": [
    {
      "id": "uuid",
      "completed": true,
      "rating": 5,
      "feedback": "Texto consolidado do feedback...",
      "bonusGranted": true,
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ]
}
```

## Métricas Jobsianas

### 1. Taxa de Conclusão (Completion Rate)
**O que importa:** Quantos usuários realmente completaram o agente?
- Meta: > 70%
- Se < 50%, há problema na trilha guiada

### 2. Rating Médio (Avg Rating)
**O que importa:** Qualidade da experiência guiada
- Meta: ≥ 4.0
- Se < 3.5, experiência precisa melhorar

### 3. Taxa de Feedback com Texto (Text Feedback Rate)
**O que importa:** Engajamento qualitativo
- Meta: > 50%
- Se < 30%, formulário pode estar muito longo/complexo

### 4. Taxa de Bônus Concedido (Bonus Rate)
**O que importa:** Eficácia do incentivo
- Meta: Alinhado com completionRate
- Se muito diferente, há problema na lógica de concessão

### 5. Distribuição de Ratings
**O que importa:** Identificar problemas específicos
- Se muitos 1-2: experiência ruim
- Se muitos 4-5: experiência boa, mas pode melhorar

### 6. Série Temporal (Daily Series)
**O que importa:** Tendências ao longo do tempo
- Completion rate melhorando?
- Rating médio subindo?
- Volume de feedbacks aumentando?

## Como Usar no Admin Dashboard

```typescript
import { adminAnalyticsRequest } from '@/lib/admin-analytics'

const analytics = await adminAnalyticsRequest({
  params: { action: 'trail_feedback_analytics' }
})

// Métricas principais
console.log(`Taxa de conclusão: ${analytics.summary.completionRate}%`)
console.log(`Rating médio: ${analytics.summary.avgRating}`)

// Distribuição de ratings
analytics.ratingDistribution.forEach(r => {
  console.log(`${r.label}: ${r.count} (${r.percentage}%)`)
})

// Feedbacks recentes para análise qualitativa
analytics.recentFeedbacks.forEach(f => {
  if (f.feedback) {
    console.log(`Rating ${f.rating}: ${f.feedback}`)
  }
})
```

## Análise Qualitativa

Os feedbacks consolidados estão em `recentFeedbacks[].feedback`. Use para:
- Identificar padrões de dificuldades
- Extrair sugestões de melhoria
- Entender o que funciona bem

**Exemplo de análise:**
```typescript
// Filtrar feedbacks negativos (rating <= 2)
const negativeFeedbacks = analytics.recentFeedbacks
  .filter(f => f.rating <= 2 && f.feedback)
  .map(f => f.feedback)

// Filtrar feedbacks positivos (rating >= 4)
const positiveFeedbacks = analytics.recentFeedbacks
  .filter(f => f.rating >= 4 && f.feedback)
  .map(f => f.feedback)
```

## Princípios Jobsianos Aplicados

1. **Simplicidade:** 3 perguntas essenciais, não 6
2. **Métricas que importam:** Completion rate, rating médio, engajamento
3. **Análise qualitativa:** Feedbacks consolidados para insights
4. **Automático:** Bônus concedido sem fricção
5. **Foco:** Uma métrica norte por release

## Próximos Passos

1. Criar painel Admin para visualizar essas métricas
2. Alertas automáticos se completionRate < 50%
3. Análise de sentimento nos feedbacks textuais (opcional)
4. A/B testing de diferentes versões do formulário

