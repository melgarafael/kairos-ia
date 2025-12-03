# Prompt Creator API

Next.js API para o Criador de Prompts com IA do TomikOS.

## Features

- Chat com streaming usando OpenAI GPT-4
- Integração com MCP Tools para acessar dados de automação
- Persistência de sessões e mensagens no Supabase
- Salvamento de prompts gerados no Client Supabase

## Setup

```bash
cd apps/prompt-creator-api
npm install
cp .env.example .env.local
# Configure as variáveis de ambiente
npm run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | URL do Supabase Master |
| `SUPABASE_ANON_KEY` | Anon key do Supabase Master |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key do Supabase Master |
| `OPENAI_API_KEY` | API key da OpenAI |

## API Endpoints

### POST /api/prompt-creator/chat

Envia mensagens e recebe resposta do AI (com streaming).

**Request:**
```json
{
  "session_id": "uuid (opcional)",
  "messages": [
    { "role": "user", "content": "Crie um agente de atendimento para clínica" }
  ],
  "stream": true
}
```

**Response (streaming):**
```
{"k":"init","traceId":"..."}
{"k":"t","d":"Olá! "}
{"k":"t","d":"Vamos "}
{"k":"tool_result","name":"listar_clientes","result":{...}}
{"k":"t","d":"criar"}
{"k":"done","full":"Olá! Vamos criar..."}
```

### GET /api/prompt-creator/sessions

Lista sessões do usuário.

### POST /api/prompt-creator/sessions

Ações de sessão:
- `action: "create"` - Criar nova sessão
- `action: "get_messages"` - Obter mensagens de uma sessão
- `action: "save_prompt"` - Salvar prompt no Client Supabase

### DELETE /api/prompt-creator/sessions?session_id=xxx

Deleta uma sessão.

## MCP Tools

O AI pode usar estas ferramentas via MCP para acessar dados:

- `listar_clientes_automacao` - Clientes de automação
- `obter_cliente` - Detalhes de um cliente
- `listar_briefings` - Briefings do negócio
- `listar_contratos` - Contratos
- `listar_processos` - Processos/tarefas
- `listar_transcricoes` - Transcrições de reuniões
- `listar_feedbacks` - Feedbacks
- `listar_documentos` - Documentos
- `obter_tools_disponiveis` - Lista de tools do tenant-mcp

## Deployment

Deploy como qualquer app Next.js (Vercel, Railway, etc).

```bash
npm run build
npm start
```

