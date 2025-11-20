# FAQ Tomik CRM

## 1) O que é o Tomik CRM?
App de CRM, Agenda e Financeiro que conecta ao seu próprio Supabase (BYO), com integrações fáceis para n8n e IA.

## 2) Para quem é e casos de uso?
Gestores de automação/ops. Funil de leads, agendamentos, financeiro, webhooks para n8n e consultas do assistente.

## 3) O que preciso para começar?
Projeto Supabase (Client) vazio, acesso ao Master para login/planos e sua URL + anon key do Client.

## 4) O que é Master x Client Supabase?
Master: auth/billing e guarda credenciais. Client: dados do CRM/Agenda/Financeiro com RLS.

## 5) Por que BYO Supabase?
Privacidade/compliance; integração; controle de performance/índices/versões.

## 6) Como o app guarda minhas credenciais?
Em `saas_users` (Master): URL e chave em Base64. Service role só nas Edge Functions.

## 7) Como conectar meu Supabase?
Tela “Conecte Seu Supabase”: URL/anon → Testar → executar SQL base → Configurar Automaticamente.

## 8) Erro de tabela obrigatória no teste?
Execute o SQL raiz (SQL Editor do seu projeto) e reteste.

## 9) Aplicar SQL raiz rapidamente
“Atualizações do Supabase” → “Copiar SQL raiz” → SQL Editor → rodar.

## 10) Manter banco atualizado
Auto Updater (beta) com função `client-schema-updater` e secrets (`DATABASE_URL`).

## 11) O que é organization_id?
Chave multi-tenant. Tabelas filtram por organização. RLS restringe por organization_id.

## 12) Como setar contexto de RLS?
RPC `set_rls_context(p_organization_id)` (quando disponível) para `app.organization_id`.

## 13) Posso trocar de Supabase?
Sim. “Trocar Supabase” reconecta e força nova organização.

## 14) Assistente de IA lê meus dados?
Somente leitura nas tabelas permitidas do Client.

## 15) Onde vejo a versão do schema?
Em “Atualizações do Supabase”: Versão Master x Sua versão + pendências.

## 16) Integrar n8n sem CORS?
Use o proxy de n8n do app (Edge Function) com `X-N8N-API-KEY`.

## 17) Listar workflows n8n
Descoberta via proxy no painel de Automação com Base URL + API Key.

## 18) Executar workflows n8n
Disparo com payload JSON via proxy.

## 19) Receber eventos do CRM no n8n
Configurar Webhooks no app: escolha eventos, cole URL do n8n e teste.

## 20) Quais eventos existem?
Lead criado/atualizado/mudança de estágio; agendamento criado/atualizado/lembretes; cliente criado/atualizado; pagamento recebido.

## 21) Kanban de CRM
`crm_stages` como colunas e `crm_leads` como cartões. DnD altera estágio.

## 22) Converter lead em cliente
Ação chama RPC que cria/atualiza `clients` e marca lead convertido.

## 23) Agenda previne conflitos
Checagem por `collaborator_id`/data-hora e status.

## 24) Financeiro
`entradas`, `saidas`, `produtos_servicos` com KPIs e fluxo.

## 25) Vínculos com financeiro
Entradas referenciam clientes/itens; leads têm `has_payment`; agendas podem ligar a pagamentos.

## 26) Notificações
`notifications` por `user_id` + `organization_id`. Leitura/atualização do próprio usuário.

## 27) Relatórios
Funil e financeiros básicos com export.

## 28) WhatsApp
Módulo e docs WuzAPI; webhooks e repositório (v7–v11).

## 29) Segurança
Não expor service role; RLS forte; evitar logs de segredos; manter schema atualizado.

## 30) Erros n8n comuns
CORS: use proxy; 401/403: revise `X-N8N-API-KEY`; timeout: valide URL pública; payload: inclua `organization_id` e datas ISO.

## 31) Tela branca/preta ao criar Organização (extensões do navegador)
O app possui um **Modo Seguro anti-extensões**. Ele ativa automaticamente quando detecta que extensões removeram nós do DOM (erros como `NotFoundError: removeChild on Node`) ou quando há falhas ao carregar scripts `chrome-extension://...`.

- Para forçar manualmente: acrescente `?safe=1` (ou `#safe=1`) à URL.
- Para sair do modo seguro: clique no banner “Sair do modo seguro” ou use `?safe=0` e recarregue.
- O modo seguro desativa filtros/blur e endurece o DOM para evitar que extensões quebrem a UI, especialmente na tela de **Organizations Setup**.
