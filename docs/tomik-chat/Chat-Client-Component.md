ChatClient Component - Documentação Completa

Visão Geral

O ChatClient é o componente principal da interface de chat do TomikAI GPTs. Ele atua como um orquestrador central que coordena toda a experiência de chat, incluindo navegação, scroll automático, streaming de respostas de LLM, e gerenciamento de estado. É um componente Client-Side que integra múltiplos hooks customizados para fornecer uma experiência de chat fluida e responsiva.

Localização: components/chat/chat-client.tsx

Arquitetura do Componente

Estrutura Hierárquica
ChatClient (Orquestrador Principal)
├── useChatNavigation - Navegação e contexto da conversa
├── useChatScroll - Controle de scroll automático
├── useChatHandlers - Manipulação de mensagens e streaming
├── ConversationLayout - Layout responsivo da conversa
│   ├── AssistantChatHeader / FlowChatHeader - Cabeçalho contextual
│   ├── ChatMessagesSection - Lista de mensagens
│   ├── TemplatesSuggestion - Sugestões para novos chats
│   ├── ChatInput - Interface de entrada de mensagens
│   └── ChatScrollDownButton - Botão de scroll para baixo
└── ChatCentered - Layout alternativo centralizado

Interface e Props

ChatClientProps
interface ChatClientProps {
  params?: { id?: string };          // ID da conversa (dinâmico da URL)
  centerLayout?: boolean;            // Ativa layout centralizado
  conversationType?: ConversationType; // CHAT ou FLOW
}

Parâmetros de Entrada
params.id: Identifica a conversa atual ('new' para novos chats)
centerLayout: Determina se usa layout centralizado ou layout padrão da conversa
conversationType: Diferencia entre chat normal (CHAT) e workflows (FLOW)

Hooks Customizados Integrados

1. useChatNavigation (hooks/chat/use-chat-navigation.ts)

Responsabilidade: Gerencia navegação, carregamento de conversas e assistentes.

Funcionalidades:
Detecta se é um novo chat vs conversa existente
Carrega assistente selecionado via URL params (assistantId)
Busca dados da conversa e mensagens para conversas existentes
Controla paginação de mensagens
Determina visibilidade do seletor de modelo LLM

Estados Retornados:
{
  isNewChat: boolean,
  selectedAssistant: Assistant,
  selectedConversation: ConversationWithProject,
  handleLoadMoreMessages: () => Promise<boolean>,
  showLlmModelSelector: () => boolean,
  hasMoreMessages: boolean,
  isLoadingMoreMessages: boolean
}

2. useChatScroll (hooks/chat/use-chat-scroll.ts)

Responsabilidade: Controle inteligente de scroll automático e manual.

Funcionalidades:
Scroll automático ao carregar mensagens iniciais
Detecção de scroll manual do usuário
Controle de quando mostrar botão "scroll to bottom"
Scroll suave durante streaming de respostas
Compatibilidade com Radix ScrollArea

Algoritmo de Scroll:
Scroll Inicial: 500ms de delay para carregar mensagens
Auto-Scroll: Ativo quando usuário está próximo ao final (margem 100px)
Detecção Manual: Desativa auto-scroll quando usuário scrolla manualmente
Streaming: Scroll contínuo durante recebimento de chunks

3. useChatHandlers (hooks/chat/use-chat-handlers.ts)

Responsabilidade: Lógica central de envio e processamento de mensagens.

Funcionalidades Principais:

handleInputSubmit
Validação: Previne múltiplas submissões simultâneas
Criação de Conversa: Para novos chats, cria conversa via API
Gerenciamento de Estado: Adiciona mensagens do usuário e assistente
Navegação: Redirect automático para nova conversa
Streaming: Processa respostas LLM em tempo real
Analytics: Tracking de eventos de conversa

processMessageWithStream - Fluxo de Streaming
1. Criação de AbortController para controle de cancelamento
2. Envio via Server-Sent Events (SSE)
3. Processamento de chunks por tipo:
   - CHUNK/CONTENT/TOKEN: Conteúdo da resposta
   - FLOW_GENERATED: Workflows gerados (N8N)
   - FEEDBACK_STATUS: Status de processamento
   - ERROR: Tratamento de erros
4. Atualização em tempo real do estado das mensagens
5. Scroll automático durante streaming

Tipos de Streaming Suportados
StreamChunkType.CHUNK: Conteúdo textual da resposta
StreamChunkType.FLOW_GENERATED: Dados de workflow (JSON)
StreamChunkType.FEEDBACK_STATUS: Status de processamento
StreamChunkType.ERROR: Mensagens de erro

handleRegenerate
Localiza mensagem do usuário anterior
Re-executa o prompt com mesmos parâmetros
Remove mensagem anterior do assistente

Estado Local e Configuração

Estado Interno
const [selectedLlmModelId, setSelectedLlmModelId] = useState<string | null>(OPENAI_GPT4O_MINI_ID);
const [initialLoadComplete, setInitialLoadComplete] = useState(false);

Constantes de Configuração
const OPENAI_GPT4O_MINI_ID = 'eb61402d-2213-440f-a48f-4d63e1061cf0'; // Modelo padrão

Refs para Controle DOM
const chatInputRef = useRef<ChatInputRef>(null);
const chatClientRef = useRef<HTMLDivElement>(null);

Lógica de Layout e Renderização

Renderização Condicional

1. Detecção de Contexto
const isNewChat = params?.id === 'new' || !params?.id;
const isNewFlowChat = isNewChat && conversationType === ConversationType.FLOW;
const showAssistantHeader = isNewChat && selectedAssistant && conversationType === ConversationType.CHAT;

2. Configuração do ChatInput

Alinhamento Dinâmico:
const getChatInputAlignment = (): ChatInputAlignment => {
  if (isNewChat) {
    return isNewFlowChat ? 'center' : 'viewport';
  }
  if (conversationType === ConversationType.FLOW) {
    return 'container';
  }
  return 'viewport';
}

Opções de Funcionalidades:
const getChatInputOptions = () => {
  if (conversationType === ConversationType.FLOW) {
    return {
      enableFileUpload: true,
      enableAudioRecording: true,
      enableWebSearch: false,  // Desabilitado para flows
    };
  }
  return {
    enableFileUpload: true,
    enableAudioRecording: true,
    enableWebSearch: true,
  };
}

Layouts Disponíveis

1. Layout Centralizado (centerLayout=true)
Usado para páginas de landing ou interfaces simplificadas.
Componente: ChatCentered
Características: Interface minimalista, seletor de modelo LLM visível

2. Layout de Conversa (Padrão)
Layout completo para conversas ativas.
Componente: ConversationLayout
Seções: Header, Messages, Suggestions, ChatInput, ScrollButton

Fluxos de Interação do Usuário

1. Início de Nova Conversa

sequenceDiagram
    participant User
    participant ChatClient
    participant ChatHandlers
    participant API

    User->>ChatClient: Digita mensagem + Enter
    ChatClient->>ChatHandlers: handleInputSubmit()
    ChatHandlers->>API: createConversation()
    API-->>ChatHandlers: conversationId
    ChatHandlers->>API: processMessageWithStream()
    API-->>ChatHandlers: SSE chunks
    ChatHandlers->>ChatClient: Atualiza mensagens
    ChatClient->>User: Redirect + streaming response

2. Conversa Existente

sequenceDiagram
    participant User
    participant ChatClient
    participant Navigation
    participant API

    User->>ChatClient: Acessa /chat/[id]
    ChatClient->>Navigation: useChatNavigation
    Navigation->>API: fetchConversation(id)
    API-->>Navigation: conversation data
    Navigation->>API: fetchMessages(id)
    API-->>Navigation: messages array
    Navigation->>ChatClient: Estado atualizado
    ChatClient->>User: Conversa carregada

3. Streaming de Resposta

sequenceDiagram
    participant ChatClient
    participant ChatHandlers
    participant StreamAPI
    participant UI

    ChatClient->>ChatHandlers: handleInputSubmit()
    ChatHandlers->>StreamAPI: processMessageWithStream()

    loop Para cada chunk
        StreamAPI-->>ChatHandlers: chunk + metadata
        ChatHandlers->>UI: setMessages(updatedMessages)
        ChatHandlers->>ChatClient: scrollToBottom()
    end

    StreamAPI-->>ChatHandlers: onComplete()
    ChatHandlers->>ChatClient: clearFeedbackChunks()

Gerenciamento de Estado Global

Integração com Zustand Stores

useChatStore
{
  messages: Message[],
  selectedConversation: ConversationWithProject,
  isGenerating: boolean,
  conversationNotFound: boolean,
  processMessageWithStream: Function,
  setMessages: Function,
  // ... outros estados e ações
}

useAssistants Store
{
  selectedAssistant: Assistant,
  fetchSelectedAssistant: Function
}

Real-time Updates
Subscriptions via Supabase Realtime para conversas
Streaming em tempo real para respostas LLM
Estados otimistas para melhor UX

Tratamento de Erros

Categorias de Erro

1. Erros de Criação de Conversa
Trigger: Falha na API de criação
Ação: Toast de erro + rollback de estado
Mensagem: "Erro ao criar conversa. Tente novamente."

2. Erros de Streaming
Trigger: Conexão SSE falha ou timeout
Ação: Remove mensagens não enviadas + feedback visual
Tipos:
NO_CONTENT_RECEIVED: Timeout sem resposta
Erros de rede: Problemas de conectividade

3. Erros de Navegação
Trigger: Conversa não encontrada (404)
Ação: Exibe ConversationNotFound component
Estado: conversationNotFound: true

Estratégias de Recovery
// Rollback de mensagens em caso de erro
if (!(error instanceof Error && error.message === 'NO_CONTENT_RECEIVED')) {
  setMessages((currentMessages) => {
    return currentMessages.filter((msg) => {
      // Remove mensagem do assistente que falhou
      if (msg.id === messageId) return false;
      // Remove mensagem do usuário recém-enviada
      if (userMessage && msg.content === userMessage.content && msg.role === 'user') {
        return false;
      }
      return true;
    });
  });
}

Performance e Otimizações

Otimizações Implementadas

1. Callbacks Memoizados
const handleInputSubmitWithScroll = useCallback(
  async (inputMessage: string, options?: {...}) => {
    setShouldAutoScroll(true);
    await handleInputSubmit(inputMessage, options);
  },
  [setShouldAutoScroll, handleInputSubmit],
);

2. Controle de Scroll Inteligente
Detecção de scroll programático vs manual
Debounce para scroll events
Otimização para dispositivos móveis

3. Prevenção de Múltiplas Submissões
// Verificação local + global
if (isProcessing) return;
const globalIsSubmitting = chatStore.getIsSubmitting();
if (globalIsSubmitting) return;

4. Lazy Loading de Mensagens
Paginação server-side
Carregamento incremental via loadMoreMessages
Virtual scrolling (se necessário para grandes históricos)

Integração com Analytics

Eventos Tracked
// Início de conversa
events.conversation.STARTED: {
  conversation_id,
  conversation_type,
  llm_model_name,
  assistant_type,
  is_assistant_from_openai
}

// Mensagem enviada
events.conversation.MESSAGE_SENT: {
  conversation_id,
  conversation_type,
  content,
  role
}

// Resposta recebida
events.conversation.MESSAGE_RECEIVED: {
  conversation_id,
  content,
  role: 'ai'
}

Casos de Uso Especiais

1. Chat com Assistentes
Header especializado: AssistantChatHeader
Configurações específicas do assistente
LLM model selector oculto
Context prompt do assistente aplicado

2. Workflows (Flows)
Header especializado: FlowChatHeader
Sugestões de templates: TemplatesSuggestion
Processamento especial de chunks FLOW_GENERATED
Integração com N8N para workflows

3. Regeneração de Mensagens
Localização da mensagem anterior do usuário
Re-envio com mesmo contexto e arquivos
Substituição da resposta anterior

4. Upload de Arquivos
Suporte a múltiplos tipos de arquivo
Conversão para FileAttachment format
Exibição visual na interface
Inclusão no contexto da conversa

Dependências e Integrações

Hooks Externos
useLlmModel: Gerenciamento de modelos LLM disponíveis
useChatStore: Estado global de conversas e mensagens
useFeatureFlags: Controle de features experimentais

Componentes Filhos
ChatInput: Interface de entrada com suporte a arquivos, áudio, web search
ChatMessagesSection: Renderização da lista de mensagens
AssistantChatHeader / FlowChatHeader: Cabeçalhos contextuais
TemplatesSuggestion: Sugestões para novos chats
ConversationNotFound: Página de erro para conversas não encontradas

APIs Integradas
Supabase Auth: Autenticação de usuários
LLM Providers: OpenAI, Anthropic, Google (via streaming)
File Upload: Supabase Storage para anexos
Analytics: PostHog + Mixpanel para tracking

Considerações de Manutenção

Pontos de Atenção

1. Ordem de Hooks
O componente chama hooks condicionalmente, mas mantém ordem consistente:
// SEMPRE na mesma ordem
const {...} = useChatNavigation({ params });
const {...} = useChatScroll({...});
const {...} = useChatHandlers({...});

2. Cleanup de Recursos
AbortControllers para cancelar requests
Timeouts para scroll automático
Cleanup de event listeners

3. Compatibilidade de Tipos
Tipos consistentes entre hooks
Interface clara para props
TypeScript strict mode compliance

Extensibilidade

Para Adicionar Novos Tipos de Streaming:
Adicionar novo StreamChunkType em lib/types/streaming.ts
Implementar handler em useChatHandlers.handleInputSubmit.onChunkReceived
Atualizar UI conforme necessário

Para Novos Tipos de Conversa:
Estender ConversationType enum
Adicionar lógica condicional em getChatInputAlignment e getChatInputOptions
Criar header específico se necessário

Última Atualização: 2025-09-26
Versão do Component: Baseado em análise do código atual
Responsável: Claude Code Analysis

Nota: Esta documentação reflete o estado atual do componente. Para mudanças futuras, atualize este documento conforme necessário.
