# Manychat Setup Flow — Novembro/2025

## Contexto

O modal `AIAgentManychatTutorialModal` é responsável por guiar o usuário desde a conexão com o n8n até a configuração final do Manychat. A experiência anterior estava travada em um único bloco: ao selecionar uma TAG, o usuário era empurrado para o próximo passo sem opção de voltar, o campo de busca ficava bloqueado e toda a sincronização dependia de uma única chamada pesada (`/manychat/fetch`). Agora seguimos a doutrina de modularidade e o manual Jobsiano: passos independentes, feedback imediato e controle total do usuário.

## Mudanças de Arquitetura

### Backend (Tenant Gateway)

- Endpoints REST dedicados:
  - `GET /api/v2/manychat/state`
  - `POST /api/v2/manychat/api-key/verify`
  - `GET /api/v2/manychat/tags`, `GET /api/v2/manychat/custom-fields`, `GET /api/v2/manychat/flows`
  - `POST /api/v2/manychat/tag`, `POST /api/v2/manychat/field`, `POST /api/v2/manychat/flow`
- Cada rota valida a sessão do usuário, identifica a organização ativa e conversa com o Manychat apenas quando necessário.
- Persistência centralizada via `manychat_credentials_upsert_full`, evitando que o frontend cheque Supabase diretamente.

### Frontend

- Novo componente `ManychatSetupSection` (lazy importado dentro do passo “Conectar Manychat no Tomik”) com sub-stepper clicável e botões “Anterior/Próximo”.
- Cada passo mostra o estado atual (`pending`, `editing`, `done`) e oferece carregamento independente com loaders inline.
- Busca “Buscar por nome...” agora é um input nativo sem capturas de evento que bloqueavam o teclado.
- `ManychatSetupSection` consulta o estado inicial no gateway e emite `onCompletionChange`, usado pelo tutorial para marcar/desmarcar o passo `manychat-connect`.
- O restante do tutorial permanece inalterado, mas o arquivo caiu de dezenas de estados `manychat*` para um único callback.

### UX

- O usuário pode navegar livremente entre os cards (API Key, TAG, Campo, Flow) e reabrir qualquer etapa para confirmar ou trocar algo.
- O botão principal só aparece quando o passo atual permite uma ação concreta (ex.: “Buscar TAGs”, “Validar API Key”).
- Checklists e mensagens de sucesso foram revisados para linguagem curta e humana.

## Como usar

1. Abra o tutorial Manychat e vá até o passo “Conectar Manychat no Tomik”.
2. Informe a API Key e clique em “Validar e salvar”. O gateway testa no Manychat e guarda o segredo com segurança.
3. Carregue TAGs, campos e flows individualmente. Todos usam a API Key já salva, então não é preciso colá-la novamente.
4. Clique em qualquer opção da grade para persistir a seleção. O card correspondente ganha o selo ✓ e o resumo confirma as IDs.
5. Depois dos quatro passos, o banner verde indica que o workflow já pode ser instalado sem edições manuais.

## Referências Técnicas

- UI: `src/components/features/Automation/manychat/ManychatSetupSection.tsx`
- Modal: `src/components/features/Automation/AIAgentManychatTutorialModal.tsx`
- Gateway: `apps/tenant-gateway/src/routes/manychat.ts`
- Cliente HTTP: `src/lib/tenant-gateway.ts`

## Próximos Passos

- Instrumentar eventos (`manychat_step_enter`, `manychat_step_success`, etc.) no novo componente.
- Implementar cache curto no gateway caso o volume de chamadas Manychat aumente.
- Criar walkthrough em vídeo curto mostrando o novo fluxo (90s) para o time de suporte.

