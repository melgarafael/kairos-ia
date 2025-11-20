## Knowledge Base (OpenAI file_search) – Como configurar e adicionar arquivos

Este projeto usa a OpenAI Responses API com a tool nativa `file_search`. Para conectar suas documentações ao assistente:

### 1) Criar um Vector Store na OpenAI
- Acesse o painel da OpenAI e crie um Vector Store (Files → Vector Stores).
- Anote o ID do Vector Store criado (ex.: vs_abc123...).

### 2) Definir as variáveis de ambiente nas Edge Functions
No projeto do Supabase (Edge Functions):
- `OPENAI_API_KEY`: sua chave da OpenAI.
- `OPENAI_RESPONSES_MODEL` (opcional): ex. `gpt-5.1-mini`.
- `OPENAI_FILE_VECTOR_STORE_IDS`: lista separada por vírgulas com os IDs do(s) vector store(s), ex.: `vs_abc123,vs_def456`.

> A function `assistant-chat-tools` já envia `tool_resources.file_search.vector_store_ids` com base nessa env.

### 3) Subir arquivos para o Vector Store
Você tem duas opções:
- Via painel da OpenAI: Upload dos arquivos (PDF, MD, HTML, TXT etc.) diretamente no Vector Store.
- Via API da OpenAI: Use os endpoints de Files/Vector Stores para criar/atualizar conteúdos.

Ou use o script CLI do projeto:

1. Configure as envs locais ao executar:
```bash
OPENAI_API_KEY=sk-xxx OPENAI_VECTOR_STORE_ID=vs_abc123 npm run sync:kb
```
2. O script varre `docs/` e faz upload de `.md,.markdown,.txt,.pdf,.html`.

Recomendado incluir:
- `docs/` do Tomik CRM (PRD, ARCHITECTURE, ONBOARDING, SECURITY, DATA-MODEL-MAP, etc.)
- Guias de integração (n8n, webhooks), FAQs e playbooks de vendas/analytics.

### 4) Como adicionar novos arquivos no futuro
- Basta fazer upload do novo arquivo no Vector Store já configurado (mesmo ID).
- Não é necessário alterar o código, desde que `OPENAI_FILE_VECTOR_STORE_IDS` já esteja setada.
- Se desejar outro conjunto de documentos separado, crie um novo Vector Store e adicione seu ID à env `OPENAI_FILE_VECTOR_STORE_IDS` (separado por vírgula). Reimplante as functions.

### 5) Boas práticas
- Prefira arquivos em `Markdown (.md)` para melhor segmentação e extração de trechos.
- Atualize documentos com histórico de versão e datas claras.
- Estruture títulos/subtítulos para melhorar a relevância nos resultados.

### 6) Verificação
- No cliente, ao fazer perguntas de “como usar”, valide que o modelo referencia conteúdos do KB.
- Acompanhe o header `x-trace-id` nas respostas e verifique logs das functions em caso de erro.


