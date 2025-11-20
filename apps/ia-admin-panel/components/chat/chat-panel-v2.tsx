"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui/cn";
import { Send, Loader2, AlertCircle, Activity, CheckCircle2, XCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { MarkdownRenderer } from "./markdown-renderer";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  streaming?: boolean;
};

type ToolLog = {
  id: string;
  label: string;
  status: "info" | "success" | "error";
  detail?: string;
  timestamp: number;
};

const starterMessage = "Pronto para operar com o IA Console V2?";

interface ChatPanelV2Props {
  sessionId: string | null;
  onSessionCreated: (id: string) => void;
}

export function ChatPanelV2({ sessionId, onSessionCreated }: ChatPanelV2Props) {
  const supabase = createSupabaseBrowserClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const skipHydrationRef = useRef(false);
  const sessionRef = useRef<string | null>(sessionId);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: generateId(),
      role: "assistant",
      content: starterMessage,
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolLogs, setToolLogs] = useState<ToolLog[]>([]);

  sessionRef.current = sessionId;

  // Load history whenever session changes (unless skipping after optimistic create)
  useEffect(() => {
    if (skipHydrationRef.current) {
      skipHydrationRef.current = false;
      return;
    }

    closeStream();
    setIsStreaming(false);
    refreshMessages(sessionId);
  }, [sessionId]);

  // Auto-scroll on message changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Autofocus textarea
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      closeStream();
    };
  }, []);

  const refreshMessages = useCallback(
    async (targetSessionId: string | null) => {
      if (!targetSessionId) {
        setMessages([
          {
            id: generateId(),
            role: "assistant",
            content: starterMessage,
            timestamp: Date.now()
          }
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
            timestamp: new Date(m.created_at).getTime()
          })) ?? [];

        setMessages(
          mapped.length > 0
            ? mapped
            : [
                {
                  id: generateId(),
                  role: "assistant",
                  content: starterMessage,
                  timestamp: Date.now()
                }
              ]
        );
      } catch (err) {
        console.error("[IA Console V2] erro ao carregar histórico", err);
      } finally {
        setHistoryLoading(false);
      }
    },
    [supabase]
  );

  async function handleSend() {
    if (!input.trim() || isStreaming) return;

    setError(null);
    setToolLogs([]);

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: input.trim(),
      timestamp: Date.now()
    };

    const optimisticMessages = [...messages.filter((m) => m.content !== starterMessage), userMessage];
    setMessages(optimisticMessages);
    setInput("");
    setIsStreaming(true);

    const placeholderId = generateId();
    setMessages((prev) => [
      ...prev,
      {
        id: placeholderId,
        role: "assistant",
        content: "",
        streaming: true,
        timestamp: Date.now()
      }
    ]);

    try {
      const res = await fetch("/api/ai-console-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: optimisticMessages,
          sessionId
        })
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? "Falha ao iniciar streaming.");
      }

      const data = (await res.json()) as { sessionId: string; requestId: string };

      if (!sessionId && data.sessionId) {
        skipHydrationRef.current = true;
        onSessionCreated(data.sessionId);
      }

      startStreaming(data.requestId, data.sessionId ?? sessionId, placeholderId);
    } catch (err: any) {
      console.error("[IA Console V2] envio", err);
      setError(err?.message ?? "Erro desconhecido");
      setIsStreaming(false);
      setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
    }
  }

  function startStreaming(
    requestId: string,
    newSessionId: string | null,
    assistantMessageId: string
  ) {
    closeStream();

    const es = new EventSource(`/api/ai-console-v2/stream?requestId=${requestId}`);
    eventSourceRef.current = es;

    const updateAssistant = (updater: (prev: string) => string) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: updater(msg.content ?? ""),
                streaming: true,
                timestamp: Date.now()
              }
            : msg
        )
      );
    };

    es.addEventListener("response.output_text.delta", (event) => {
      const data = parseEventData(event);
      const delta = typeof data?.delta === "string" ? data.delta : data?.text ?? "";
      if (delta) {
        updateAssistant((prev) => prev + delta);
      }
    });

    es.addEventListener("response.output_text.done", (event) => {
      const data = parseEventData(event);
      if (typeof data?.text === "string") {
        updateAssistant(() => data.text);
      }
    });

    es.addEventListener("response.mcp_call.in_progress", (event) =>
      handleToolEvent("in_progress", parseEventData(event))
    );
    es.addEventListener("response.mcp_call_arguments.delta", (event) =>
      handleToolEvent("arguments_delta", parseEventData(event))
    );
    es.addEventListener("response.mcp_call_arguments.done", (event) =>
      handleToolEvent("arguments_done", parseEventData(event))
    );
    es.addEventListener("response.mcp_call.completed", (event) =>
      handleToolEvent("completed", parseEventData(event))
    );
    es.addEventListener("response.mcp_call.failed", (event) =>
      handleToolEvent("failed", parseEventData(event))
    );

    es.addEventListener("done", async () => {
      finalizeAssistantMessage(assistantMessageId);
      setIsStreaming(false);
      closeStream();
      await refreshMessages(newSessionId ?? sessionRef.current ?? null);
    });

    es.addEventListener("error", (event) => {
      console.warn("[IA Console V2] SSE error", event);
      finalizeAssistantMessage(assistantMessageId);
      setError("Streaming interrompido. Tente novamente.");
      setIsStreaming(false);
      closeStream();
    });
  }

  function finalizeAssistantMessage(messageId: string) {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              streaming: false
            }
          : msg
      )
    );
  }

  function closeStream() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }

  function handleToolEvent(stage: string, data: any) {
    const entry = mapToolEvent(stage, data);
    setToolLogs((prev) => {
      const next = [...prev, entry];
      return next.slice(-6);
    });
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmptyState =
    messages.length === 0 ||
    (messages.length === 1 && messages[0].content === starterMessage);

  return (
    <div>
      <section className="glass-panel rounded-2xl border border-white/5 flex flex-col h-[calc(100vh-12rem)] overflow-hidden">
        <div
          className={cn(
            "flex-1 overflow-y-auto px-6 py-6 space-y-4",
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
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="text-2xl md:text-3xl font-medium text-foreground/80 text-center mb-8"
                >
                  {starterMessage}
                </motion.h2>
              ) : (
                messages
                  .filter((m) => m.content !== starterMessage)
                  .map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                      className={cn(
                        "flex",
                        message.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-5 py-3.5",
                          "transition-all duration-200",
                          message.role === "assistant"
                            ? "bg-white/5 border border-white/10"
                            : "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        )}
                      >
                        <MarkdownRenderer
                          content={message.content || "..."}
                          isUserMessage={message.role === "user"}
                          className="font-[450]"
                        />
                        {message.streaming && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground/70 mt-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Gerando resposta...</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))
              )}
            </AnimatePresence>
          )}

          {!isEmptyState && isStreaming && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 flex items-center gap-3">
                <Loader2 size={16} className="animate-spin text-white/50" />
                <span className="text-[15px] text-foreground/70">Processando...</span>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-white/5 p-6 space-y-3 bg-card/50">
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-2.5"
              >
                <AlertCircle size={16} className="text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive font-medium">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {toolLogs.length > 0 && (
            <div className="bg-muted/20 border border-muted/30 rounded-lg p-3 space-y-2">
              {toolLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2">
                  <span className="mt-0.5">
                    {log.status === "success" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : log.status === "error" ? (
                      <XCircle className="w-3.5 h-3.5 text-destructive" />
                    ) : (
                      <Activity className="w-3.5 h-3.5 text-primary" />
                    )}
                  </span>
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-foreground/80">{log.label}</p>
                    {log.detail && (
                      <p className="text-[11px] text-muted-foreground/80 mt-0.5 line-clamp-2">
                        {log.detail}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Comande o console com linguagem natural..."
                className={cn(
                  "min-h-[52px] max-h-[200px] resize-none",
                  "text-[15px] leading-relaxed",
                  "pr-12"
                )}
                disabled={isStreaming}
              />
              <div className="absolute bottom-3 right-3 text-xs text-muted-foreground/50">
                {input.length > 0 && `${input.length} caracteres`}
              </div>
            </div>
            <Button
              onClick={handleSend}
              disabled={isStreaming || !input.trim()}
              size="lg"
              className={cn(
                "h-[52px] px-6 min-w-[52px]",
                "bg-primary text-primary-foreground",
                "hover:bg-primary/90 shadow-lg shadow-primary/20",
                "transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isStreaming ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Send size={20} />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/60 text-center">
            Pressione <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">Enter</kbd> para enviar,
            <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">Shift+Enter</kbd> para nova linha
          </p>
        </div>
      </section>
    </div>
  );
}

function mapToolEvent(stage: string, data: any): ToolLog {
  const base: ToolLog = {
    id: `${stage}-${Date.now()}`,
    label: "MCP em execução",
    status: "info",
    detail: undefined,
    timestamp: Date.now()
  };

  const toolName = data?.name ?? data?.item_id ?? "mcp";

  switch (stage) {
    case "in_progress":
      return {
        ...base,
        label: `Executando ${toolName}`,
        status: "info"
      };
    case "arguments":
    case "arguments_delta":
      return {
        ...base,
        label: `Montando argumentos (${toolName})`,
        detail: truncate(JSON.stringify(data?.arguments ?? data ?? {}))
      };
    case "arguments_done":
      return {
        ...base,
        label: `Argumentos prontos (${toolName})`,
        detail: truncate(data?.arguments ?? "")
      };
    case "completed":
      return {
        ...base,
        label: `Tool finalizada (${toolName})`,
        status: "success"
      };
    case "failed":
      return {
        ...base,
        label: `Tool falhou (${toolName})`,
        status: "error",
        detail: data?.error ?? JSON.stringify(data ?? {})
      };
    default:
      return {
        ...base,
        label: `Evento ${stage} (${toolName})`,
        detail: truncate(JSON.stringify(data ?? {}))
      };
  }
}

function truncate(value: string, max = 120) {
  if (!value) return undefined;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function parseEventData(event: MessageEvent) {
  try {
    return JSON.parse(event.data);
  } catch {
    return null;
  }
}

function generateId() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}


