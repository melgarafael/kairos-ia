# Plano de Migração para NestJS - Assistant/IA e Migrations

## 📋 Sumário Executivo

Este documento detalha a migração dos módulos **Assistant/IA** e **Migrations** do Supabase Edge Functions para NestJS, incluindo estrutura de projeto, dependências, implementação passo a passo e estratégia de migração gradual.

---

## 🎯 Escopo da Migração

### Módulo 1: Assistant/IA
- ✅ `assistant-chat` - Orquestrador multiagentes (OpenAI Responses API)
- ✅ `assistant-chat-stream` - Streaming SSE para chat
- ✅ `assistant-chat-tools` - Ferramentas do assistente
- ✅ `assistant-transcribe` - Transcrição de áudio (Whisper)
- ✅ `assistant-prepare-attachments` - Preparação de anexos (PDF, imagens, texto)

### Módulo 2: Migrations
- ✅ `client-schema-updater` - Atualização de schema do Client Supabase
- ✅ `check-and-apply-migrations` - Verificação e aplicação de migrações

---

## 📦 Estrutura do Projeto NestJS

```
tomikcrm-backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   │
│   ├── common/
│   │   ├── decorators/
│   │   │   └── organization.decorator.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── guards/
│   │   │   ├── auth.guard.ts
│   │   │   └── organization.guard.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts
│   │   │   └── transform.interceptor.ts
│   │   └── utils/
│   │       └── cors.util.ts
│   │
│   ├── config/
│   │   ├── database.config.ts
│   │   ├── openai.config.ts
│   │   └── supabase.config.ts
│   │
│   ├── modules/
│   │   ├── assistant/
│   │   │   ├── assistant.module.ts
│   │   │   ├── assistant.controller.ts
│   │   │   ├── assistant.service.ts
│   │   │   ├── services/
│   │   │   │   ├── openai.service.ts
│   │   │   │   ├── orchestrator.service.ts
│   │   │   │   ├── transcription.service.ts
│   │   │   │   └── attachments.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── chat.dto.ts
│   │   │   │   ├── transcribe.dto.ts
│   │   │   │   └── attachments.dto.ts
│   │   │   └── types/
│   │   │       ├── chat.types.ts
│   │   │       └── agent.types.ts
│   │   │
│   │   └── migrations/
│   │       ├── migrations.module.ts
│   │       ├── migrations.controller.ts
│   │       ├── migrations.service.ts
│   │       ├── services/
│   │       │   ├── schema-updater.service.ts
│   │       │   └── migration-checker.service.ts
│   │       ├── dto/
│   │       │   ├── schema-update.dto.ts
│   │       │   └── migration-check.dto.ts
│   │       └── types/
│   │           └── migration.types.ts
│   │
│   └── shared/
│       ├── services/
│       │   └── supabase.service.ts
│       └── utils/
│           └── crypto.util.ts
│
├── test/
│   ├── unit/
│   └── e2e/
│
├── docker/
│   └── Dockerfile
│
├── .env.example
├── package.json
├── tsconfig.json
└── nest-cli.json
```

---

## 📦 Dependências Necessárias

### package.json

```json
{
  "name": "tomikcrm-backend",
  "version": "1.0.0",
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/platform-express": "^10.3.0",
    "@nestjs/config": "^3.1.1",
    "@nestjs/swagger": "^7.1.17",
    "@nestjs/throttler": "^5.1.1",
    "@nestjs/schedule": "^4.0.0",
    "@supabase/supabase-js": "^2.39.3",
    "openai": "^4.24.1",
    "pg": "^8.11.3",
    "pdf-parse": "^1.1.1",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.2.1",
    "@nestjs/schematics": "^10.0.3",
    "@nestjs/testing": "^10.3.0",
    "@types/node": "^20.10.6",
    "@types/pg": "^8.10.9",
    "@types/pdf-parse": "^1.1.4",
    "typescript": "^5.3.3",
    "ts-node": "^10.9.2",
    "ts-loader": "^9.5.1",
    "tsconfig-paths": "^4.2.0"
  }
}
```

---

## 🚀 Fase 1: Setup Inicial (Semana 1)

### Dia 1-2: Projeto Base

#### 1.1 Criar projeto NestJS

```bash
npm i -g @nestjs/cli
nest new tomikcrm-backend
cd tomikcrm-backend
```

#### 1.2 Instalar dependências

```bash
npm install @nestjs/common @nestjs/core @nestjs/platform-express
npm install @nestjs/config @nestjs/swagger @nestjs/throttler
npm install @supabase/supabase-js openai pg pdf-parse
npm install class-validator class-transformer
```

#### 1.3 Configuração de ambiente (.env.example)

```env
# Server
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGINS=http://localhost:5173,https://app.tomikcrm.com

# Supabase Master
MASTER_SUPABASE_URL=https://xxx.supabase.co
MASTER_SUPABASE_ANON_KEY=xxx
MASTER_SUPABASE_SERVICE_ROLE_KEY=xxx

# Supabase Database (para migrations)
SUPABASE_DB_URL=postgresql://postgres:xxx@xxx.supabase.co:5432/postgres

# OpenAI
OPENAI_API_KEY=sk-xxx

# App
APP_PUBLIC_URL=http://localhost:5173
```

#### 1.4 Configurar módulos base

**src/config/supabase.config.ts**
```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('supabase', () => ({
  master: {
    url: process.env.MASTER_SUPABASE_URL,
    anonKey: process.env.MASTER_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.MASTER_SUPABASE_SERVICE_ROLE_KEY,
  },
  database: {
    url: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL,
  },
}));
```

**src/config/openai.config.ts**
```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('openai', () => ({
  apiKey: process.env.OPENAI_API_KEY,
}));
```

**src/app.module.ts**
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import supabaseConfig from './config/supabase.config';
import openaiConfig from './config/openai.config';
import { AssistantModule } from './modules/assistant/assistant.module';
import { MigrationsModule } from './modules/migrations/migrations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [supabaseConfig, openaiConfig],
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    AssistantModule,
    MigrationsModule,
  ],
})
export class AppModule {}
```

#### 1.5 Health Check

**src/main.ts**
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS
  const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['*'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('TomikCRM Backend API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}`);
}

bootstrap();
```

---

## 🤖 Fase 2: Módulo Assistant/IA (Semanas 2-3)

### Semana 2: Estrutura Base e Chat Não-Streaming

#### 2.1 Criar módulo Assistant

```bash
nest g module modules/assistant
nest g controller modules/assistant
nest g service modules/assistant
```

#### 2.2 Tipos e DTOs

**src/modules/assistant/types/chat.types.ts**
```typescript
export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type PreparedAttachment = {
  kind: 'text' | 'image';
  name: string;
  mime: string;
  size?: number;
  content?: string;
  dataUrl?: string;
};

export type OrchestratorMeta = {
  route?: 'tomik' | 'manychat' | 'n8n' | 'supabase' | 'generic';
  topic?: string;
  system_prompt?: string;
  style?: {
    locale?: string;
    concise?: boolean;
    step_by_step?: boolean;
  };
};
```

**src/modules/assistant/dto/chat.dto.ts**
```typescript
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ChatMessageDto {
  @IsString()
  role: 'user' | 'assistant' | 'system';

  @IsString()
  content: string;
}

export class ChatRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @IsOptional()
  orchestrator?: {
    route?: string;
    topic?: string;
    system_prompt?: string;
  };

  @IsOptional()
  @IsString()
  user_id?: string;

  @IsOptional()
  @IsString()
  organization_id?: string;

  @IsOptional()
  attachments?: any[];

  @IsOptional()
  stream?: boolean;
}
```

#### 2.3 Serviço OpenAI

**src/modules/assistant/services/openai.service.ts**
```typescript
import { Injectable, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import OpenAI from 'openai';
import openaiConfig from '../../../config/openai.config';

@Injectable()
export class OpenAIService {
  private client: OpenAI;

  constructor(
    @Inject(openaiConfig.KEY)
    private config: ConfigType<typeof openaiConfig>,
  ) {
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
    });
  }

  async chat(payload: {
    model: string;
    input: any[];
    temperature?: number;
    max_output_tokens?: number;
  }): Promise<{ ok: boolean; status: number; json: any }> {
    try {
      // OpenAI Responses API
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await response.json().catch(() => ({}));
      return {
        ok: response.ok,
        status: response.status,
        json,
      };
    } catch (error) {
      return {
        ok: false,
        status: 500,
        json: { error: error.message },
      };
    }
  }

  async transcribe(file: Buffer, filename: string, mimeType: string): Promise<string> {
    const fileBlob = new Blob([file], { type: mimeType });
    const formData = new FormData();
    formData.append('file', fileBlob, filename);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'json');
    formData.append('temperature', '0');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI transcription error: ${text}`);
    }

    const json = await response.json();
    return json.text || '';
  }
}
```

#### 2.4 Serviço Orchestrator

**src/modules/assistant/services/orchestrator.service.ts**
```typescript
import { Injectable } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { ChatMessage, OrchestratorMeta } from '../types/chat.types';

@Injectable()
export class OrchestratorService {
  constructor(private openaiService: OpenAIService) {}

  async classifyIntent(
    lastUserText: string,
    meta?: OrchestratorMeta,
  ): Promise<{ route: string; question: string }> {
    // Se já tem route definido, usar
    if (meta?.route) {
      return {
        route: meta.route,
        question: lastUserText,
      };
    }

    // Classificação heurística local (fallback)
    const route = this.classifyHeuristic(lastUserText);

    // Tentar classificação via OpenAI se necessário
    try {
      const systemPrompt = `Você é um ORQUESTRADOR multiagentes em pt-BR. Classifique o tema da última mensagem do usuário em uma destas rotas: "tomik", "manychat", "n8n", "supabase", "generic".
Responda APENAS com JSON válido na raiz, sem comentários, no formato:
{"route":"tomik|manychat|n8n|supabase|generic","question":"(reforma a pergunta de forma objetiva, mantendo intenção)"}`;

      const response = await this.openaiService.chat({
        model: 'gpt-4.1-mini',
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: lastUserText },
        ],
        temperature: 0,
      });

      if (response.ok) {
        const output = this.extractOutputText(response.json);
        const parsed = this.safeJSON(output);
        if (parsed?.route && parsed?.question) {
          return {
            route: parsed.route,
            question: parsed.question,
          };
        }
      }
    } catch (error) {
      console.warn('Orchestrator classification failed, using heuristic:', error);
    }

    return {
      route,
      question: lastUserText,
    };
  }

  private classifyHeuristic(text: string): string {
    const t = text.toLowerCase();
    if (/many ?chat|whatsapp template|hsm|instagram dm|broadcast/.test(t)) return 'manychat';
    if (/\bn8n\b|workflow|node http|function item/.test(t)) return 'n8n';
    if (/supabase|rls|policy|edge function|sql/.test(t)) return 'supabase';
    if (/tomik|crm|kanban|leads|agendamento/.test(t)) return 'tomik';
    return 'generic';
  }

  private extractOutputText(obj: any): string {
    if (!obj) return '';
    if (typeof obj.output_text === 'string' && obj.output_text.trim()) {
      return obj.output_text.trim();
    }
    if (Array.isArray(obj.output) && obj.output.length) {
      const texts: string[] = [];
      for (const item of obj.output) {
        const contents = (item && item.content) || [];
        if (Array.isArray(contents)) {
          for (const c of contents) {
            const t = c?.text?.value || c?.text || c?.value || c?.content || '';
            if (typeof t === 'string' && t.trim()) texts.push(t);
          }
        }
      }
      if (texts.length) return texts.join('\n').trim();
    }
    return '';
  }

  private safeJSON(text: string): any | null {
    try {
      const cleaned = String(text || '')
        .trim()
        .replace(/^```(json)?/i, '')
        .replace(/```$/i, '')
        .trim();
      try {
        return JSON.parse(cleaned);
      } catch {}
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          return JSON.parse(m[0]);
        } catch {}
      }
      return null;
    } catch {
      return null;
    }
  }

  getSystemPromptForAgent(agent: string, override?: string): string {
    if (override && override.trim()) return override;
    
    // Retornar prompts dos agentes (mesmos do código original)
    // Por brevidade, aqui retornamos apenas o genérico
    // Em produção, carregar de arquivo ou banco de dados
    return 'Você é um assistente técnico em pt-BR. Seja conciso, humano e útil.';
  }
}
```

#### 2.5 Controller e Service Principal

**src/modules/assistant/assistant.service.ts**
```typescript
import { Injectable } from '@nestjs/common';
import { OpenAIService } from './services/openai.service';
import { OrchestratorService } from './services/orchestrator.service';
import { ChatMessage, PreparedAttachment } from './types/chat.types';

@Injectable()
export class AssistantService {
  constructor(
    private openaiService: OpenAIService,
    private orchestratorService: OrchestratorService,
  ) {}

  async chat(
    messages: ChatMessage[],
    meta?: any,
    attachments?: PreparedAttachment[],
  ): Promise<{ reply: string; agent: string; traceId: string }> {
    const traceId = crypto.randomUUID();
    const lastUserText = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';

    // Classificar intenção
    const { route, question } = await this.orchestratorService.classifyIntent(lastUserText, meta);

    // Obter prompt do agente
    const systemPrompt = this.orchestratorService.getSystemPromptForAgent(route, meta?.system_prompt);

    // Preparar input para OpenAI
    const input = this.prepareInput(systemPrompt, messages, question, attachments);

    // Determinar modelo (com imagem usa gpt-4o-mini)
    const hasImage = attachments?.some(a => a.kind === 'image' && a.dataUrl);
    const modelName = hasImage ? 'gpt-4o-mini' : 'gpt-4.1-mini';

    // Chamar OpenAI
    const response = await this.openaiService.chat({
      model: modelName,
      input,
      temperature: 0.2,
      max_output_tokens: 1200,
    });

    if (!response.ok) {
      throw new Error(`OpenAI error: ${JSON.stringify(response.json)}`);
    }

    const text = this.extractOutputText(response.json);
    const finalText = text?.trim() || 'Oi! Como posso te ajudar no Tomik CRM, ManyChat, n8n ou Supabase?';

    return {
      reply: finalText,
      agent: route,
      traceId,
    };
  }

  private prepareInput(
    systemPrompt: string,
    history: ChatMessage[],
    lastQuestion: string,
    attachments?: PreparedAttachment[],
  ): any[] {
    const arr: any[] = [];
    if (systemPrompt) {
      arr.push({ role: 'system', content: systemPrompt });
    }
    arr.push({
      role: 'system',
      content: `Agora é ${new Date().toLocaleString('pt-BR')} (pt-BR).`,
    });

    // Processar anexos (limitar para evitar exceder limites)
    const imgs = (attachments || [])
      .filter(a => a && a.kind === 'image' && a.dataUrl)
      .slice(0, 1);
    const texts = (attachments || [])
      .filter(a => a && a.kind === 'text' && a.content)
      .slice(0, 2);

    // Encontrar última mensagem do usuário
    const lastUserIndex = [...history].reverse().findIndex(m => m.role === 'user');
    const lastIndex = lastUserIndex >= 0 ? history.length - 1 - lastUserIndex : -1;

    for (let i = 0; i < history.length; i++) {
      const m = history[i];
      const role = m.role === 'system' ? 'user' : m.role;

      if (i === lastIndex && (imgs.length > 0 || texts.length > 0)) {
        const parts: any[] = [];
        parts.push({ type: 'input_text', text: m.content });
        for (const im of imgs) {
          parts.push({ type: 'input_image', image_url: im.dataUrl });
        }
        for (const tx of texts) {
          const snippet = String(tx.content || '').slice(0, 1000);
          if (snippet) {
            parts.push({ type: 'input_text', text: `Anexo ${tx.name}:\n${snippet}` });
          }
        }
        arr.push({ role, content: parts });
        continue;
      }
      arr.push({ role, content: m.content });
    }

    return arr;
  }

  private extractOutputText(obj: any): string {
    if (!obj) return '';
    if (typeof obj.output_text === 'string' && obj.output_text.trim()) {
      return obj.output_text.trim();
    }
    if (Array.isArray(obj.output) && obj.output.length) {
      const texts: string[] = [];
      for (const item of obj.output) {
        const contents = (item && item.content) || [];
        if (Array.isArray(contents)) {
          for (const c of contents) {
            const t = c?.text?.value || c?.text || c?.value || c?.content || '';
            if (typeof t === 'string' && t.trim()) texts.push(t);
          }
        }
      }
      if (texts.length) return texts.join('\n').trim();
    }
    return '';
  }
}
```

**src/modules/assistant/assistant.controller.ts**
```typescript
import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AssistantService } from './assistant.service';
import { ChatRequestDto } from './dto/chat.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

@ApiTags('Assistant')
@Controller('assistant')
@UseGuards(AuthGuard)
export class AssistantController {
  constructor(private assistantService: AssistantService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Chat com assistente de IA' })
  async chat(@Body() dto: ChatRequestDto) {
    return this.assistantService.chat(
      dto.messages,
      dto.orchestrator,
      dto.attachments,
    );
  }
}
```

### Semana 3: Streaming e Utilitários

#### 3.1 Implementar Streaming SSE

**src/modules/assistant/assistant.controller.ts** (adicionar método)
```typescript
import { Sse } from '@nestjs/common';

@Post('chat-stream')
@Sse()
async chatStream(@Body() dto: ChatRequestDto) {
  return this.assistantService.chatStream(
    dto.messages,
    dto.orchestrator,
    dto.attachments,
  );
}
```

**src/modules/assistant/assistant.service.ts** (adicionar método)
```typescript
import { Observable } from 'rxjs';

async chatStream(
  messages: ChatMessage[],
  meta?: any,
  attachments?: PreparedAttachment[],
): Promise<Observable<{ data: string }>> {
  return new Observable((subscriber) => {
    const traceId = crypto.randomUUID();
    
    // Enviar init
    subscriber.next({ data: JSON.stringify({ k: 'init', traceId }) + '\n' });

    // Implementar streaming similar ao código Deno
    // Usar fetch com stream e converter para Observable
    this.handleStreaming(messages, meta, attachments, subscriber, traceId)
      .catch((error) => {
        subscriber.error(error);
      });
  });
}

private async handleStreaming(
  messages: ChatMessage[],
  meta: any,
  attachments: PreparedAttachment[],
  subscriber: any,
  traceId: string,
) {
  // Preparar payload
  const systemPrompt = this.orchestratorService.getSystemPromptForAgent(
    meta?.route || 'generic',
    meta?.system_prompt,
  );
  const input = this.prepareInput(systemPrompt, messages, '', attachments);
  const hasImage = attachments?.some(a => a.kind === 'image');
  const modelName = hasImage ? 'gpt-4o-mini' : 'gpt-4.1-mini';

  // Fazer requisição streaming
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelName,
      input,
      temperature: 0.2,
      max_output_tokens: 1200,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error('OpenAI stream error');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let currentEvent: string | null = null;

  // Keep-alive ping a cada 10s
  const keepAliveInterval = setInterval(() => {
    subscriber.next({ data: JSON.stringify({ k: 'ping' }) + '\n' });
  }, 10000);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        subscriber.next({ data: JSON.stringify({ k: 'done' }) + '\n' });
        subscriber.complete();
        clearInterval(keepAliveInterval);
        return;
      }

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;

        if (line.startsWith('event:')) {
          currentEvent = line.slice('event:'.length).trim();
          continue;
        }

        if (line.startsWith('data:')) {
          const dataStr = line.slice('data:'.length).trim();
          if (dataStr === '[DONE]') {
            subscriber.next({ data: JSON.stringify({ k: 'done' }) + '\n' });
            subscriber.complete();
            clearInterval(keepAliveInterval);
            return;
          }

          try {
            const obj = JSON.parse(dataStr);
            if (currentEvent === 'response.output_text.delta' || currentEvent === 'message.delta') {
              const delta = String(obj?.delta || obj?.text || '');
              if (delta) {
                subscriber.next({ data: JSON.stringify({ k: 't', d: delta }) + '\n' });
              }
            } else if (currentEvent === 'response.completed' || currentEvent === 'message.completed') {
              subscriber.next({ data: JSON.stringify({ k: 'done' }) + '\n' });
              subscriber.complete();
              clearInterval(keepAliveInterval);
              return;
            } else if (currentEvent === 'response.error' || obj?.error) {
              const errMsg = String(obj?.error?.message || obj?.message || 'stream_error');
              subscriber.next({ data: JSON.stringify({ k: 'err', d: errMsg }) + '\n' });
              subscriber.next({ data: JSON.stringify({ k: 'done' }) + '\n' });
              subscriber.complete();
              clearInterval(keepAliveInterval);
              return;
            }
          } catch {
            // Fallback: passar como delta raw
            subscriber.next({ data: JSON.stringify({ k: 't', d: dataStr }) + '\n' });
          }
        }
      }
    }
  } catch (error) {
    clearInterval(keepAliveInterval);
    subscriber.error(error);
  }
}
```

#### 3.2 Serviço de Transcrição

**src/modules/assistant/services/transcription.service.ts**
```typescript
import { Injectable } from '@nestjs/common';
import { OpenAIService } from './openai.service';

@Injectable()
export class TranscriptionService {
  constructor(private openaiService: OpenAIService) {}

  async transcribe(file: Express.Multer.File): Promise<{ text: string }> {
    const text = await this.openaiService.transcribe(
      file.buffer,
      file.originalname,
      file.mimetype,
    );
    return { text };
  }
}
```

**src/modules/assistant/assistant.controller.ts** (adicionar)
```typescript
import { FileInterceptor } from '@nestjs/platform-express';
import { UseInterceptors, UploadedFile } from '@nestjs/common';

@Post('transcribe')
@UseInterceptors(FileInterceptor('file'))
async transcribe(@UploadedFile() file: Express.Multer.File) {
  return this.assistantService.transcribe(file);
}
```

#### 3.3 Serviço de Anexos

**src/modules/assistant/services/attachments.service.ts**
```typescript
import { Injectable } from '@nestjs/common';
import { PreparedAttachment } from '../types/chat.types';
import * as pdfParse from 'pdf-parse';

@Injectable()
export class AttachmentsService {
  async prepareAttachments(files: Express.Multer.File[]): Promise<{ attachments: PreparedAttachment[] }> {
    const prepared: PreparedAttachment[] = [];
    const totalSize = files.reduce((acc, f) => acc + f.size, 0);

    if (totalSize > 20 * 1024 * 1024) {
      throw new Error('Total attachments too large');
    }

    for (const f of files.slice(0, 6)) {
      const name = f.originalname || 'file';
      const mime = f.mimetype || 'application/octet-stream';

      if (mime.startsWith('image/')) {
        const b64 = f.buffer.toString('base64');
        prepared.push({
          kind: 'image',
          name,
          mime,
          dataUrl: `data:${mime};base64,${b64}`,
          size: f.size,
        });
        continue;
      }

      if (mime.includes('pdf')) {
        const text = await this.readPdfAsText(f.buffer);
        prepared.push({
          kind: 'text',
          name,
          mime,
          content: text,
          size: f.size,
        });
        continue;
      }

      if (
        mime.includes('json') ||
        mime.includes('markdown') ||
        mime.includes('md') ||
        mime.includes('html') ||
        mime.includes('csv') ||
        mime.startsWith('text/') ||
        name.toLowerCase().endsWith('.csv')
      ) {
        const text = this.readTextFile(f.buffer.toString('utf-8'), mime);
        prepared.push({
          kind: 'text',
          name,
          mime,
          content: text,
          size: f.size,
        });
        continue;
      }

      prepared.push({
        kind: 'text',
        name,
        mime,
        content: `Arquivo ${name} (${mime}) anexado, mas não processado.`,
        size: f.size,
      });
    }

    return { attachments: prepared };
  }

  private async readPdfAsText(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      const maxPages = Math.min(data.numpages, 30);
      let text = '';
      for (let i = 1; i <= maxPages; i++) {
        text += `\n\n[Page ${i}]\n${data.text}`;
      }
      return this.sanitizeText(text);
    } catch (e) {
      return this.sanitizeText(buffer.toString('utf-8').slice(0, 200000));
    }
  }

  private readTextFile(text: string, mime: string): string {
    if (mime.includes('html')) {
      return this.sanitizeText(
        text
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' '),
      );
    }
    return this.sanitizeText(text);
  }

  private sanitizeText(input: string): string {
    return input.replace(/\u0000/g, '').slice(0, 250000);
  }
}
```

**src/modules/assistant/assistant.controller.ts** (adicionar)
```typescript
import { FilesInterceptor } from '@nestjs/platform-express';

@Post('prepare-attachments')
@UseInterceptors(FilesInterceptor('files', 6))
async prepareAttachments(@UploadedFiles() files: Express.Multer.File[]) {
  return this.assistantService.prepareAttachments(files);
}
```

---

## 🔄 Fase 3: Módulo Migrations (Semanas 4-5)

### Semana 4: Schema Updater

#### 4.1 Criar módulo Migrations

```bash
nest g module modules/migrations
nest g controller modules/migrations
nest g service modules/migrations
```

#### 4.2 Tipos e DTOs

**src/modules/migrations/types/migration.types.ts**
```typescript
export type Migration = {
  id: string;
  name: string;
  sql?: string;
  sqlUrl?: string;
  versionTag?: string;
  checksum?: string;
};

export type Manifest = {
  version: string;
  migrations: Migration[];
};

export type MigrationStep = {
  version: number;
  name?: string;
  status: 'success' | 'error';
  error?: string;
};
```

**src/modules/migrations/dto/schema-update.dto.ts**
```typescript
import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MigrationDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  sql?: string;

  @IsOptional()
  @IsString()
  sqlUrl?: string;

  @IsOptional()
  @IsString()
  versionTag?: string;
}

export class ManifestDto {
  @IsString()
  version: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MigrationDto)
  migrations: MigrationDto[];
}

export class SchemaUpdateRequestDto {
  @IsString()
  action: 'plan' | 'apply' | 'status' | 'status_public' | 'get_code';

  @IsOptional()
  manifest?: ManifestDto;

  @IsOptional()
  @IsString()
  manifestUrl?: string;
}
```

#### 4.3 Serviço Schema Updater

**src/modules/migrations/services/schema-updater.service.ts**
```typescript
import { Injectable } from '@nestjs/common';
import { Client } from 'pg';
import { Migration, Manifest, MigrationStep } from '../types/migration.types';

@Injectable()
export class SchemaUpdaterService {
  async plan(client: Client, manifest: Manifest): Promise<{
    ok: boolean;
    pending: Migration[];
    current_version?: string;
  }> {
    // Buscar versão atual do cliente
    const currentVersion = await this.getCurrentVersion(client);

    // Filtrar migrations pendentes
    const pending = manifest.migrations.filter((m) => {
      const version = this.extractVersion(m.versionTag || m.id);
      return version > currentVersion;
    });

    return {
      ok: true,
      pending,
      current_version: String(currentVersion),
    };
  }

  async apply(
    client: Client,
    manifest: Manifest,
  ): Promise<{ ok: boolean; steps: MigrationStep[] }> {
    const steps: MigrationStep[] = [];
    const currentVersion = await this.getCurrentVersion(client);

    for (const m of manifest.migrations) {
      const version = this.extractVersion(m.versionTag || m.id);
      if (version <= currentVersion) {
        continue; // Já aplicada
      }

      try {
        let sql = m.sql || '';
        if (m.sqlUrl) {
          const response = await fetch(m.sqlUrl);
          sql = await response.text();
        }

        // Remover BEGIN/COMMIT externos
        const sanitized = this.stripOuterTransaction(sql);
        const wrapped = `
          BEGIN;
          SET LOCAL statement_timeout = '300s';
          ${sanitized}
          INSERT INTO public.app_migrations(version, applied_at)
          VALUES ('${version}', NOW())
          ON CONFLICT (version) DO NOTHING;
          COMMIT;
        `;

        await client.query(wrapped);
        steps.push({ version, name: m.name, status: 'success' });
      } catch (error: any) {
        steps.push({
          version,
          name: m.name,
          status: 'error',
          error: error.message,
        });
        throw error; // Parar em caso de erro
      }
    }

    return { ok: true, steps };
  }

  private async getCurrentVersion(client: Client): Promise<number> {
    // Garantir que tabela existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.app_migrations(
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const result = await client.query(`
      SELECT COALESCE(
        MAX(
          CASE
            WHEN version ~ '^[0-9]+$' THEN version::INT
            WHEN version ~ '^v?[0-9]+' THEN (REGEXP_REPLACE(version, '^v?([0-9]+).*', '\\1'))::INT
            ELSE 0
          END
        ),
        0
      )::INT AS v
      FROM public.app_migrations;
    `);

    return Number(result.rows[0]?.v || 0);
  }

  private extractVersion(versionTag: string): number {
    const match = versionTag.match(/^v?(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private stripOuterTransaction(sqlText: string): string {
    let text = (sqlText || '').replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/);

    // Remover prelude (comentários, SET)
    let i = 0;
    while (i < lines.length) {
      const t = lines[i].trim();
      if (t === '' || t.startsWith('--')) {
        i++;
        continue;
      }
      if (/^set\s+(local\s+)?search_path\b/i.test(t)) {
        i++;
        continue;
      }
      if (/^set\s+(local\s+)?statement_timeout\b/i.test(t)) {
        i++;
        continue;
      }
      break;
    }

    // Remover BEGIN inicial
    if (i < lines.length && /^begin;?$/i.test(lines[i].trim())) {
      lines.splice(i, 1);
      while (i < lines.length && lines[i].trim() === '') lines.splice(i, 1);
    }

    // Remover COMMIT final
    let j = lines.length - 1;
    while (j >= 0) {
      const t = lines[j].trim();
      if (t === '' || t.startsWith('--')) {
        j--;
        continue;
      }
      break;
    }
    if (j >= 0 && /^commit;?$/i.test(lines[j].trim())) {
      lines.splice(j, 1);
      while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
    }

    return lines.join('\n');
  }
}
```

#### 4.4 Controller Schema Updater

**src/modules/migrations/migrations.controller.ts**
```typescript
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MigrationsService } from './migrations.service';
import { SchemaUpdateRequestDto } from './dto/schema-update.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

@ApiTags('Migrations')
@Controller('migrations')
@UseGuards(AuthGuard)
export class MigrationsController {
  constructor(private migrationsService: MigrationsService) {}

  @Post('schema-updater')
  @ApiOperation({ summary: 'Atualizar schema do Client Supabase' })
  async schemaUpdater(@Body() dto: SchemaUpdateRequestDto) {
    return this.migrationsService.handleSchemaUpdate(dto);
  }
}
```

### Semana 5: Migration Checker

#### 5.1 Serviço Migration Checker

**src/modules/migrations/services/migration-checker.service.ts**
```typescript
import { Injectable } from '@nestjs/common';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { ConfigType } from '@nestjs/config';
import supabaseConfig from '../../../config/supabase.config';

@Injectable()
export class MigrationCheckerService {
  constructor(
    @Inject(supabaseConfig.KEY)
    private config: ConfigType<typeof supabaseConfig>,
  ) {}

  async checkAndApply(
    organizationId: string,
    userId: string,
    mode: 'status' | 'apply' | 'auto' = 'auto',
  ): Promise<{
    ok: boolean;
    master_version: number;
    client_version_before: number;
    client_version_after: number;
    pending: number;
    auto_applied: boolean;
    steps?: any[];
  }> {
    // 1. Buscar credenciais do cliente no Master
    const masterClient = createClient(
      this.config.master.url,
      this.config.master.serviceRoleKey,
    );

    const { data: orgRow, error: orgErr } = await masterClient
      .from('saas_organizations')
      .select('owner_id, client_supabase_url, client_service_key_encrypted, id, client_org_id')
      .or(`client_org_id.eq.${organizationId},id.eq.${organizationId}`)
      .eq('owner_id', userId)
      .maybeSingle();

    if (orgErr || !orgRow) {
      throw new Error('organization_not_found_or_not_owned');
    }

    // 2. Decodificar service role key
    const serviceKey = this.decodeServiceKey(orgRow.client_service_key_encrypted);
    if (!serviceKey) {
      throw new Error('service_role_not_configured');
    }

    // 3. Obter project_ref da URL
    const projectRef = this.deriveProjectRefFromUrl(orgRow.client_supabase_url);
    if (!projectRef) {
      throw new Error('invalid_client_supabase_url');
    }

    // 4. Carregar migrations do Master
    const masterPg = new Client({ connectionString: this.config.database.url });
    await masterPg.connect();
    try {
      const masterVersion = await this.getMasterMaxVersion(masterPg);
      const masterMigrations = await this.loadMasterMigrations(masterPg);

      // 5. Obter versão atual do cliente
      const clientVersionBefore = await this.getClientVersion(projectRef, serviceKey);

      // 6. Filtrar pendentes
      const pending = masterMigrations.filter(
        (m) => Number(m.version) > clientVersionBefore,
      );

      if (pending.length === 0) {
        return {
          ok: true,
          master_version: masterVersion,
          client_version_before: clientVersionBefore,
          client_version_after: clientVersionBefore,
          pending: 0,
          auto_applied: false,
        };
      }

      if (mode === 'status') {
        return {
          ok: true,
          master_version: masterVersion,
          client_version_before: clientVersionBefore,
          client_version_after: clientVersionBefore,
          pending: pending.length,
          auto_applied: false,
        };
      }

      // 7. Aplicar migrations (com lock)
      const steps = await this.applyMigrationsWithLock(
        organizationId,
        projectRef,
        serviceKey,
        pending,
        masterVersion,
      );

      const clientVersionAfter = await this.getClientVersion(projectRef, serviceKey);

      return {
        ok: true,
        master_version: masterVersion,
        client_version_before: clientVersionBefore,
        client_version_after: clientVersionAfter,
        pending: pending.length,
        auto_applied: mode !== 'status',
        steps,
      };
    } finally {
      await masterPg.end();
    }
  }

  private async getMasterMaxVersion(client: Client): Promise<number> {
    const result = await client.query(`
      SELECT COALESCE(MAX(version::INT), 0)::INT AS v
      FROM public.master_migrations;
    `);
    return Number(result.rows?.[0]?.v || 0);
  }

  private async loadMasterMigrations(client: Client): Promise<
    Array<{ version: number; name: string; sql: string }>
  > {
    const result = await client.query(`
      SELECT version::INT AS version,
             COALESCE(name, 'v' || version::TEXT) AS name,
             sql
      FROM public.master_migrations
      ORDER BY version::INT ASC;
    `);
    return result.rows.filter((r) => r.sql && String(r.sql).trim() !== '');
  }

  private async getClientVersion(projectRef: string, serviceKey: string): Promise<number> {
    const clientUrl = `https://${projectRef}.supabase.co`;
    const client = createClient(clientUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await client
      .from('app_migrations')
      .select('version')
      .order('applied_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') return 0;
      throw error;
    }

    if (!data || data.length === 0) return 0;

    const versions = data
      .map((row) => {
        const v = String(row.version || '');
        const match = v.match(/^v?(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((v) => v > 0);

    return versions.length > 0 ? Math.max(...versions) : 0;
  }

  private async applyMigrationsWithLock(
    organizationId: string,
    projectRef: string,
    serviceKey: string,
    pending: Array<{ version: number; name: string; sql: string }>,
    masterVersion: number,
  ): Promise<any[]> {
    // Implementar lock via PostgreSQL advisory lock
    // Similar ao código Deno original
    // Por brevidade, aqui apenas aplicamos sem lock detalhado
    // Em produção, implementar pg_try_advisory_lock

    const steps: any[] = [];
    for (const m of pending) {
      try {
        await this.executeSqlOverHttp(projectRef, serviceKey, m.sql, m.version);
        steps.push({ version: m.version, name: m.name, status: 'success' });
      } catch (error: any) {
        steps.push({
          version: m.version,
          name: m.name,
          status: 'error',
          error: error.message,
        });
        throw error;
      }
    }
    return steps;
  }

  private async executeSqlOverHttp(
    projectRef: string,
    serviceKey: string,
    sql: string,
    version: number,
  ): Promise<void> {
    const sanitized = this.stripOuterTransaction(sql);
    const wrapped = `
      BEGIN;
      SET LOCAL statement_timeout = '300s';
      ${sanitized}
      INSERT INTO public.app_migrations(version, applied_at)
      VALUES ('${version}', NOW())
      ON CONFLICT (version) DO NOTHING;
      COMMIT;
    `;

    const endpoint = `https://${projectRef}.supabase.co/postgres/v1/query`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'prefer': 'tx=read-write',
        'apikey': serviceKey,
        'authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ query: wrapped }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SQL execution failed: ${text}`);
    }
  }

  private decodeServiceKey(encrypted: string): string | null {
    try {
      return Buffer.from(encrypted.replace(/\s+/g, ''), 'base64').toString('utf-8');
    } catch {
      return null;
    }
  }

  private deriveProjectRefFromUrl(url: string): string | null {
    try {
      const u = new URL(url);
      const host = u.hostname;
      const parts = host.split('.');
      if (parts.length >= 3 && parts[1] === 'supabase') return parts[0];
      return null;
    } catch {
      return null;
    }
  }

  private stripOuterTransaction(sqlText: string): string {
    // Mesma implementação do SchemaUpdaterService
    // ... (código igual ao anterior)
  }
}
```

#### 5.2 Controller Migration Checker

**src/modules/migrations/migrations.controller.ts** (adicionar)
```typescript
@Post('check-and-apply')
@ApiOperation({ summary: 'Verificar e aplicar migrations pendentes' })
async checkAndApply(
  @Body() dto: { organization_id: string; mode?: 'status' | 'apply' | 'auto' },
  @Req() req: any,
) {
  return this.migrationsService.checkAndApply(
    dto.organization_id,
    req.user.id,
    dto.mode || 'auto',
  );
}
```

---

## 🔐 Fase 4: Autenticação e Guards (Semana 6)

### 6.1 Guard de Autenticação

**src/common/guards/auth.guard.ts**
```typescript
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { ConfigType } from '@nestjs/config';
import supabaseConfig from '../../config/supabase.config';

@Injectable()
export class AuthGuard implements CanActivate {
  private supabase;

  constructor(
    @Inject(supabaseConfig.KEY)
    private config: ConfigType<typeof supabaseConfig>,
  ) {
    this.supabase = createClient(
      this.config.master.url,
      this.config.master.anonKey,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);
    const { data: { user }, error } = await this.supabase.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException('Invalid token');
    }

    request.user = user;
    return true;
  }
}
```

---

## 🧪 Fase 5: Testes e Deploy (Semana 7)

### 7.1 Testes Unitários

**test/unit/assistant.service.spec.ts**
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AssistantService } from '../../src/modules/assistant/assistant.service';
import { OpenAIService } from '../../src/modules/assistant/services/openai.service';
import { OrchestratorService } from '../../src/modules/assistant/services/orchestrator.service';

describe('AssistantService', () => {
  let service: AssistantService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssistantService,
        {
          provide: OpenAIService,
          useValue: {
            chat: jest.fn(),
          },
        },
        {
          provide: OrchestratorService,
          useValue: {
            classifyIntent: jest.fn(),
            getSystemPromptForAgent: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AssistantService>(AssistantService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

### 7.2 Dockerfile

**docker/Dockerfile**
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 3000

CMD ["node", "dist/main"]
```

### 7.3 Deploy

**Opções de Deploy:**
1. **Railway** (recomendado para início)
2. **Render**
3. **Fly.io**
4. **AWS Lambda** (com adaptador serverless)

---

## 📋 Checklist de Migração

### Pré-Migração
- [ ] Backup completo do banco Master
- [ ] Documentar todas as Edge Functions
- [ ] Mapear dependências entre funções
- [ ] Setup de ambiente de staging

### Durante Migração
- [ ] Migrar uma função por vez
- [ ] Testes unitários para cada função
- [ ] Testes de integração
- [ ] Comparar resultados novo vs antigo
- [ ] Monitorar logs e erros
- [ ] Feature flags para rollback

### Pós-Migração
- [ ] Remover Edge Functions antigas
- [ ] Atualizar frontend para usar nova API
- [ ] Atualizar documentação
- [ ] Monitorar performance
- [ ] Otimizar queries lentas

---

## 🎯 Estratégia de Migração Gradual

### Abordagem: Strangler Fig Pattern

1. **Proxy Reverso**: Criar rota NestJS que proxy para Edge Functions antigas
2. **Migrar uma função por vez**: Substituir proxy por implementação NestJS
3. **Feature Flags**: Usar flags para alternar entre novo/antigo
4. **Testes paralelos**: Rodar ambos em produção, comparar resultados
5. **Desligar Edge Function**: Após validação, remover proxy

### Exemplo de Proxy Temporário

```typescript
@Controller('assistant')
export class AssistantController {
  @Post('chat')
  async chat(@Body() dto: ChatRequestDto) {
    // Feature flag: usar novo ou antigo
    if (process.env.USE_NESTJS_ASSISTANT === 'true') {
      return this.assistantService.chat(dto.messages, dto.orchestrator, dto.attachments);
    }
    
    // Proxy para Edge Function antiga
    const edgeFunctionUrl = `${process.env.SUPABASE_EDGE_URL}/assistant-chat`;
    return fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });
  }
}
```

---

## 📊 Estimativa de Tempo

- **Fase 1 (Setup)**: 2 dias
- **Fase 2 (Assistant)**: 2 semanas
- **Fase 3 (Migrations)**: 2 semanas
- **Fase 4 (Auth/Guards)**: 3 dias
- **Fase 5 (Testes/Deploy)**: 1 semana

**Total**: ~6-7 semanas (com 1 desenvolvedor full-time)

---

## ✅ Conclusão

Este plano fornece uma estrutura completa para migrar os módulos Assistant/IA e Migrations para NestJS, mantendo compatibilidade com o sistema existente e permitindo migração gradual sem downtime.










