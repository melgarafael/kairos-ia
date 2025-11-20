# 🔭 Blueprint · Manychat Setup Flow Refactor

**Data:** 2025-11-18  
**Status:** Planejamento aprovado  
**Owner:** Squad Automations (Steve Jobs lead)

---

## 1. Problema

| Sintoma | Impacto |
| --- | --- |
| Stepper rígido trava avanço/retrocesso; ao escolher opção errada o usuário cai no próximo passo sem conseguir retornar. | Usuários precisam fechar o modal e reabrir para corrigir, gerando abandono. |
| Campo de busca "Buscar por nome..." dentro do grid de opções não aceita digitação (event handlers bloqueando inputs). | Impossível filtrar TAGs/flows/campos em contas com dezenas de itens. |
| Integração Manychat concentra tudo em um endpoint `/manychat/fetch` + RPC única. Falhas numa chamada derrubam todo o fluxo. | Erros são difíceis de diagnosticar, estado fica inconsistente, não há retry individual. |
| Step visual único com botões "Passo 1/2/3" não permite navegação livre ou reconsulta específica. | UX engessada, não atende heurísticas Jobsianas de simplicidade e controle. |

---

## 2. Objetivos

1. **Navegação fluida:** qualquer passo pode ser acessado diretamente (clicando ou via "Anterior/Próximo") sem perder dados já validados.
2. **Busca funcional:** input responsivo com debounce e highlight imediato dos resultados.
3. **Arquitetura modular:** cada passo possui hook/API dedicada, com loading e erros isolados.
4. **Observabilidade:** métricas/telemetria por passo (success/fail/time) para reduzir suporte.

KPIs:  
- Tempo médio para concluir os 3 passos ≤ 90s.  
- Erros de "não consigo voltar" e "busca não funciona" → zero tickets pós release.

---

## 3. Escopo & Arquivos

| Camada | Arquivos |
| --- | --- |
| UI | `src/components/features/Automation/AIAgentManychatTutorialModal.tsx` (será fatiado), `src/components/features/Automation/manychat/` *(novos subcomponents)* |
| Hooks/State | `src/hooks/useManychatSetup.ts` *(novo)* |
| Gateway Client | `src/lib/tenant-gateway.ts` (novas funções REST) |
| Backend | `apps/tenant-gateway/src/routes/manychat.ts` (rotas separadas) |
| Docs | Este blueprint + `docs/features/automation-manychat.md` (após execução) |

---

## 4. Arquitetura Proposta

### 4.1 UX / Flow

```
[StepperHorizontal]
  ├─ Step 0 · API Key
  ├─ Step 1 · TAG de resposta
  ├─ Step 2 · Campo personalizado
  └─ Step 3 · Flow Manychat
```

* Stepper clicável, com estado `pending | editing | done`.
* Botões `Anterior/Próximo` sempre visíveis; apenas o CTA final depende de validação completa.
* Cada step mostra:
  - Header com instruções + status badge.
  - Área de conteúdo (input, grid ou combobox).
  - Footer com ações do step (`Validar`, `Carregar`, `Salvar`).
* Busca usa `<Input>` padrão; removal dos handlers que bloqueavam evento. `useDebounceValue` para reduzir chamadas.

### 4.2 Estado & Hooks

`useManychatSetup`:
- `apiKey`, `tag`, `field`, `flow` (draft + persisted values).
- `loaders` e `errors` por step.
- `verifyApiKey`, `listTags`, `listFields`, `listFlows`, `persistSelection`.
- Integra com `React Query` (`useMutation`/`useQuery`) para caching e retry.

Cada subcomponente (`ManychatApiKeyStep`, `ManychatTagStep`, etc.) recebe apenas props necessárias e dispara suas mutações.

### 4.3 Backend / Gateway

Novas rotas autenticadas:

1. `POST /api/v2/manychat/api-key/verify`
   - Body `{ apiKey }`
   - Retorna `{ valid: boolean }` e salva/atualiza credencial parcial.

2. `GET /api/v2/manychat/tags?search=...`
3. `GET /api/v2/manychat/custom-fields?search=...`
4. `GET /api/v2/manychat/flows?search=...`
   - Todas usam `fetchManychatEndpoint` compartilhado e cache local leve (TTL 60s em memória) para evitar rate limit.

5. `POST /api/v2/manychat/tag`
6. `POST /api/v2/manychat/field`
7. `POST /api/v2/manychat/flow`
   - Persistem seleção incremental via RPC `manychat_credentials_upsert_partial`.

8. `GET /api/v2/manychat/state`
   - Retorna snapshot consolidado (apiKey mask, itens selecionados, timestamps).

### 4.4 Dados & Persistência

| Ação | Supabase RPC | Notas |
| --- | --- | --- |
| Salvar API Key | `manychat_credentials_upsert_partial(api_key => encrypt)` | Retorna `id`, `updated_at`. |
| Salvar seleção | Mesmo RPC com campos específicos (tag/field/flow). | Logs Traces (`trackSafe`). |
| Consultar progresso | `fetchManychatCredentials` existente (reutilizado). |

### 4.5 Telemetria

Eventos `trackSafe`:
- `manychat_step_enter`, `manychat_step_success`, `manychat_step_error`.
- Payload: `{ step: 'api-key' | 'tag' | 'field' | 'flow', durationMs }`.

---

## 5. Critérios de Sucesso

- [ ] Navegar entre passos sem perder estado (incluindo reabrir modal).
- [ ] Campo "Buscar por nome..." aceita input imediatamente e filtra em ≤150ms.
- [ ] Cada chamada Manychat exibe loading inline e mensagem de erro localizada.
- [ ] Backend rotas respondem com códigos adequados (400 validação, 502 upstream).
- [ ] Documentação atualizada com novo fluxo + screenshots.
- [ ] Testes manuais: cenários com API key inválida, sem resultados de busca, troca de step após erro.

---

## 6. Plano de Execução

1. **Backend**
   - [ ] Criar schemas zod por rota.
   - [ ] Adicionar cache e logging estruturado.
   - [ ] Atualizar `tenant-gateway.ts` com novos helpers.
2. **Frontend Foundation**
   - [ ] Criar `useManychatSetup`.
   - [ ] Quebrar modal em subcomponentes + stepper novo.
3. **UX Enhancements**
   - [ ] Implementar input de busca com debounce + teclado acessível.
   - [ ] Botões prev/next + estado persistente em `localStorage`.
4. **QA & Docs**
   - [ ] Smoke tests (API key inválida, reloading steps, trocar seleção).
   - [ ] Atualizar `docs/features/automation-manychat.md` com novo fluxo.

---

## 7. Riscos & Mitigações

| Risco | Mitigação |
| --- | --- |
| Manychat rate limit ao buscar listas repetidamente | Cache curto no gateway + debounce de busca no front. |
| Estado inconsistente se usuário fecha modal no meio | Hook persiste draft em `localStorage` + endpoint `/state`. |
| Regressão em workflows existentes | Mantemos RPC atual para compatibilidade; novas rotas escrevem no mesmo registro. |

---

> **Mantra Jobsiano aplicado:** Escolhemos passos essenciais, demos controle total ao usuário e cortamos acoplamentos invisíveis. O resultado esperado é uma experiência suave, com cada interação respondendo imediatamente e sem surpresas.

