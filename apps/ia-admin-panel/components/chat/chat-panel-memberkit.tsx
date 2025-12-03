"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui/cn";
import {
  Send,
  Loader2,
  AlertCircle,
  GraduationCap,
  Bot,
  User,
  RefreshCw,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { MarkdownRenderer } from "./markdown-renderer";
import { ToolExecutionGroup, ToolCallData } from "./tool-execution-card";

// Types
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  streaming?: boolean;
  toolCalls?: ToolCallData[];
}

interface StreamEvent {
  k: string;
  d?: string;
  traceId?: string;
  sessionId?: string;
  name?: string;
  category?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  full?: string;
  toolCalls?: number;
  // Streaming events
  loop?: number;
  totalLoops?: number;
  thinking?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

// Starter message
const STARTER_MESSAGE = `Olá! Sou o **Agente de Acessos Memberkit**. Posso ajudar você a:

- 👥 Buscar e gerenciar membros/alunos
- 📚 Consultar cursos e progresso
- 💳 Verificar assinaturas e turmas
- 🏆 Gerenciar pontuações e rankings
- 💬 Moderar comentários
- 🔑 Gerar links de acesso

Como posso ajudar?`;

interface ChatPanelMemberkitProps {
  sessionId: string | null;
  onSessionCreated: (id: string) => void;
}

export function ChatPanelMemberkit({ sessionId, onSessionCreated }: ChatPanelMemberkitProps) {
  const supabase = createSupabaseBrowserClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const skipHydrationRef = useRef(false);
  const sessionRef = useRef<string | null>(sessionId);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: generateId(),
      role: "assistant",
      content: STARTER_MESSAGE,
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCallData[]>([]);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const [currentLoop, setCurrentLoop] = useState<number | null>(null);

  sessionRef.current = sessionId;

  // Load history on session change
  useEffect(() => {
    if (skipHydrationRef.current) {
      skipHydrationRef.current = false;
      return;
    }
    abortStream();
    setIsStreaming(false);
    setCurrentToolCalls([]);
    setAgentStatus(null);
    setCurrentLoop(null);
    refreshMessages(sessionId);
  }, [sessionId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentToolCalls, agentStatus]);

  // Autofocus
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => abortStream();
  }, []);

  const refreshMessages = useCallback(
    async (targetSessionId: string | null) => {
      if (!targetSessionId) {
        setMessages([
          {
            id: generateId(),
            role: "assistant",
            content: STARTER_MESSAGE,
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      setHistoryLoading(true);
      try {
        const { data, error } = await supabase
          .from("admin_chat_messages")
          .select("*")
          .eq("session_id", targetSessionId)
          .order("created_at", { ascending: true });

        if (error) throw error;

        const mapped =
          data?.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            timestamp: new Date(m.created_at).getTime(),
            toolCalls: m.metadata?.tool_calls || undefined,
          })) ?? [];

        setMessages(
          mapped.length > 0
            ? mapped
            : [
                {
                  id: generateId(),
                  role: "assistant",
                  content: STARTER_MESSAGE,
                  timestamp: Date.now(),
                },
              ]
        );
      } catch (err) {
        console.error("[IA Console Memberkit] erro ao carregar histórico", err);
      } finally {
        setHistoryLoading(false);
      }
    },
    [supabase]
  );

  function abortStream() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }

  async function handleSend() {
    if (!input.trim() || isStreaming) return;

    setError(null);
    setCurrentToolCalls([]);
    setAgentStatus(null);
    setCurrentLoop(null);

    const userContent = input.trim();

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: userContent,
      timestamp: Date.now(),
    };

    const optimisticMessages = [
      ...messages.filter((m) => m.content !== STARTER_MESSAGE),
      userMessage,
    ];
    setMessages(optimisticMessages);
    
    setInput("");
    setIsStreaming(true);

    const assistantId = generateId();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
        timestamp: Date.now(),
      },
    ]);

    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch("/api/ia-console-memberkit/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: optimisticMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          sessionId,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        // Check if response is JSON
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          console.error("[IA Console Memberkit] Response is not JSON:", contentType);
          throw new Error("Erro de conexão. Verifique se você está logado e recarregue a página.");
        }
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? "Falha ao iniciar streaming.");
      }

      // Get session ID from headers
      const newSessionId = res.headers.get("x-session-id");
      if (!sessionId && newSessionId) {
        skipHydrationRef.current = true;
        onSessionCreated(newSessionId);
      }

      // Process stream
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      const toolCallsMap = new Map<string, ToolCallData>();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const event: StreamEvent = JSON.parse(line);

            switch (event.k) {
              case "init":
                setAgentStatus("Inicializando...");
                break;

              case "thinking":
                setAgentStatus(event.thinking || "Analisando...");
                break;

              case "loop_start":
                setCurrentLoop(event.loop || 1);
                setAgentStatus(`Loop ${event.loop}/${event.totalLoops || 5} - Processando...`);
                break;

              case "model_call":
                setAgentStatus(`Consultando modelo ${event.model || "GPT-5.1"}...`);
                break;

              case "t":
                // Text delta
                if (event.d) {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantId
                        ? { ...msg, content: msg.content + event.d }
                        : msg
                    )
                  );
                  setAgentStatus(null);
                }
                break;

              case "tools_start":
                setAgentStatus("Executando ferramentas...");
                break;

              case "tool_executing":
                if (event.name) {
                  const toolCall: ToolCallData = {
                    id: `${event.name}-${Date.now()}`,
                    name: event.name,
                    category: event.category || "memberkit",
                    status: "executing",
                    arguments: event.args,
                    startTime: Date.now(),
                  };
                  toolCallsMap.set(event.name, toolCall);
                  setCurrentToolCalls(Array.from(toolCallsMap.values()));
                  setAgentStatus(`Executando: ${event.name}`);
                }
                break;

              case "tool_result":
                if (event.name) {
                  const existing = toolCallsMap.get(event.name);
                  if (existing) {
                    existing.status = "success";
                    existing.result = event.result;
                    existing.endTime = Date.now();
                    setCurrentToolCalls(Array.from(toolCallsMap.values()));
                  }
                }
                break;

              case "tool_error":
                if (event.name) {
                  const existing = toolCallsMap.get(event.name);
                  if (existing) {
                    existing.status = "error";
                    existing.error = event.error;
                    existing.endTime = Date.now();
                    setCurrentToolCalls(Array.from(toolCallsMap.values()));
                  }
                }
                break;

              case "tools_end":
                setAgentStatus("Analisando resultados...");
                break;

              case "usage":
                // Token usage info
                console.log(`[IA Console Memberkit] Tokens: ${event.inputTokens} in, ${event.outputTokens} out`);
                break;

              case "done":
                // Stream complete
                const finalToolCalls = Array.from(toolCallsMap.values());
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? {
                          ...msg,
                          content: event.full || msg.content,
                          streaming: false,
                          toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
                        }
                      : msg
                  )
                );
                setCurrentToolCalls([]);
                setAgentStatus(null);
                setCurrentLoop(null);
                break;

              case "err":
                setError(event.d || "Erro desconhecido");
                setAgentStatus(null);
                break;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("[IA Console Memberkit] Error:", err);
      setError((err as Error).message || "Erro desconhecido");
    } finally {
      setIsStreaming(false);
      setAgentStatus(null);
      setCurrentLoop(null);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId ? { ...msg, streaming: false } : msg
        )
      );
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmptyState =
    messages.length === 0 ||
    (messages.length === 1 && messages[0].content === STARTER_MESSAGE);

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div
        className={cn(
          "flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-6",
          isEmptyState && "flex flex-col justify-center items-center"
        )}
      >
        {historyLoading ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground/70">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Carregando histórico...
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {isEmptyState ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="text-center space-y-4 max-w-xl"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
                  <GraduationCap className="w-8 h-8 text-emerald-400" />
                </div>
                <div className="prose prose-invert prose-sm">
                  <MarkdownRenderer content={STARTER_MESSAGE} />
                </div>
              </motion.div>
            ) : (
              messages
                .filter((m) => m.content !== STARTER_MESSAGE)
                .map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                    className="space-y-3"
                  >
                    <div
                      className={cn(
                        "flex gap-3",
                        message.role === "user" ? "flex-row-reverse" : ""
                      )}
                    >
                      {/* Avatar */}
                      <div
                        className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0",
                          message.role === "assistant"
                            ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30"
                            : "bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30"
                        )}
                      >
                        {message.role === "assistant" ? (
                          <Bot className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <User className="w-4 h-4 text-blue-400" />
                        )}
                      </div>

                      {/* Message Content */}
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-3",
                          message.role === "assistant"
                            ? "bg-white/5 border border-white/10"
                            : "bg-gradient-to-br from-blue-600 to-cyan-600 text-white"
                        )}
                      >
                        <MarkdownRenderer
                          content={message.content || "..."}
                          isUserMessage={message.role === "user"}
                        />
                        {message.streaming && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground/70 mt-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>{agentStatus || "Gerando resposta..."}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tool Calls for this message */}
                    {message.toolCalls && message.toolCalls.length > 0 && (
                      <div className="ml-11">
                        <ToolExecutionGroup tools={message.toolCalls} />
                      </div>
                    )}
                  </motion.div>
                ))
            )}
          </AnimatePresence>
        )}

        {/* Agent Status Indicator */}
        {agentStatus && !isEmptyState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-sm text-emerald-400 ml-11"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{agentStatus}</span>
            {currentLoop && (
              <span className="text-xs text-muted-foreground">
                (Loop {currentLoop})
              </span>
            )}
          </motion.div>
        )}

        {/* Current Tool Calls (while streaming) */}
        {currentToolCalls.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="ml-11"
          >
            <ToolExecutionGroup tools={currentToolCalls} title="Executando..." />
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-white/10 p-4 md:p-6 bg-gradient-to-t from-background via-background/95 to-background/90 backdrop-blur-xl">
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 mb-4"
            >
              <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300 flex-1">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="text-red-300 hover:text-red-200 hover:bg-red-500/10"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Busque membros, consulte progresso, gerencie acessos..."
              className={cn(
                "min-h-[56px] max-h-[200px] resize-none",
                "text-[15px] leading-relaxed",
                "bg-white/5 border-white/10 focus:border-emerald-500/50",
                "rounded-xl pr-12",
                "placeholder:text-muted-foreground/50"
              )}
              disabled={isStreaming}
            />
            {input.length > 0 && (
              <div className="absolute bottom-3 right-3 text-xs text-muted-foreground/40">
                {input.length}
              </div>
            )}
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            size="icon"
            className={cn(
              "h-[56px] w-[56px] rounded-xl",
              "bg-emerald-600 hover:bg-emerald-500",
              "shadow-lg shadow-emerald-500/25",
              "transition-all duration-300",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "flex items-center justify-center"
            )}
          >
            {isStreaming ? (
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            ) : (
              <Send className="h-5 w-5 text-white" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground/50 text-center mt-3">
          <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
            Enter
          </kbd>{" "}
          para enviar,{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
            Shift+Enter
          </kbd>{" "}
          para nova linha
        </p>
      </div>
    </div>
  );
}

function generateId() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

