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
  Sparkles,
  Bot,
  User,
  RefreshCw,
  Moon,
  Sun,
  Star,
  Mic,
  Square,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { MarkdownRenderer } from "./markdown-renderer";
import { ToolExecutionGroup, ToolCallData } from "./tool-execution-card";
import { KairosThinkingCard, KairosStatusIndicator } from "./kairos-thinking-card";

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
  loop?: number;
  totalLoops?: number;
  thinking?: string;
  reasoning?: string;
  humanized?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

// Kairos starter message - mystical and welcoming
const KAIROS_STARTER_MESSAGE = `🌟 **Olá! Sou a Kairos**, sua mentora de Human Design.

Estou aqui para ajudá-la a:

- ✨ **Compreender seu design** único
- 🌙 **Aplicar sua estratégia** no dia a dia  
- 💫 **Honrar sua autoridade** nas decisões
- 🔮 **Descobrir padrões** de energia e comportamento

*Conte-me como posso ajudá-la hoje. O que está em seu coração?*`;

interface ChatPanelKairosProps {
  sessionId: string | null;
  onSessionCreated: (id: string) => void;
}

export function ChatPanelKairos({ sessionId, onSessionCreated }: ChatPanelKairosProps) {
  const supabase = createSupabaseBrowserClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const skipHydrationRef = useRef(false);
  const sessionRef = useRef<string | null>(sessionId);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: generateId(),
      role: "assistant",
      content: KAIROS_STARTER_MESSAGE,
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCallData[]>([]);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const [reasoningContent, setReasoningContent] = useState<string>("");
  const [isReasoningStreaming, setIsReasoningStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  sessionRef.current = sessionId;

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentToolCalls, agentStatus, reasoningContent]);

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
      console.log(`[ChatPanelKairos] refreshMessages called with sessionId: ${targetSessionId}`);
      
      if (!targetSessionId) {
        console.log("[ChatPanelKairos] No sessionId, showing starter message");
        setMessages([
          {
            id: generateId(),
            role: "assistant",
            content: KAIROS_STARTER_MESSAGE,
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      setHistoryLoading(true);
      try {
        const { data, error } = await supabase
          .from("ai_messages")
          .select("*")
          .eq("session_id", targetSessionId)
          .order("created_at", { ascending: true });

        console.log(`[ChatPanelKairos] Query result:`, { 
          sessionId: targetSessionId, 
          messageCount: data?.length ?? 0, 
          error: error?.message || null 
        });

        if (error) throw error;

        const mapped =
          data?.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            timestamp: new Date(m.created_at).getTime(),
            toolCalls: m.metadata?.tool_calls || undefined,
          })) ?? [];

        console.log(`[ChatPanelKairos] Mapped ${mapped.length} messages`);

        setMessages(
          mapped.length > 0
            ? mapped
            : [
                {
                  id: generateId(),
                  role: "assistant",
                  content: KAIROS_STARTER_MESSAGE,
                  timestamp: Date.now(),
                },
              ]
        );
      } catch (err) {
        console.error("[ChatPanelKairos] Error loading history:", err);
      } finally {
        setHistoryLoading(false);
      }
    },
    [supabase]
  );

  // Load history on session change (must be after refreshMessages definition)
  useEffect(() => {
    if (skipHydrationRef.current) {
      skipHydrationRef.current = false;
      return;
    }
    abortStream();
    setIsStreaming(false);
    setCurrentToolCalls([]);
    setAgentStatus(null);
    setReasoningContent("");
    setIsReasoningStreaming(false);
    refreshMessages(sessionId);
  }, [sessionId, refreshMessages]);

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
    setReasoningContent("");
    setIsReasoningStreaming(false);

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    const optimisticMessages = [
      ...messages.filter((m) => m.content !== KAIROS_STARTER_MESSAGE),
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
      const res = await fetch("/api/kairos/stream", {
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
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
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
                setAgentStatus("✨ Sintonizando com sua energia...");
                break;

              case "thinking":
                setAgentStatus(event.thinking || "Analisando...");
                break;

              case "reasoning":
                // Reasoning/thinking content from AI
                if (event.d) {
                  setIsReasoningStreaming(true);
                  setReasoningContent((prev) => prev + event.d);
                }
                break;

              case "loop_start":
                setAgentStatus(`🌀 Processando (${event.loop}/${event.totalLoops || 5})...`);
                break;

              case "model_call":
                setAgentStatus("💭 Consultando sabedoria...");
                break;

              case "t":
                // Text delta - clear reasoning when text starts
                if (event.d) {
                  setIsReasoningStreaming(false);
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

              case "tool_executing":
                if (event.name) {
                  const toolCall: ToolCallData = {
                    id: `${event.name}-${Date.now()}`,
                    name: event.name,
                    category: event.category || "system",
                    status: "executing",
                    arguments: event.args,
                    startTime: Date.now(),
                  };
                  toolCallsMap.set(event.name, toolCall);
                  setCurrentToolCalls(Array.from(toolCallsMap.values()));
                  setAgentStatus(event.humanized || `Executando: ${event.name}`);
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
                  setAgentStatus(event.humanized || null);
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

              case "usage":
                console.log(`[Kairos] Tokens: ${event.inputTokens} in, ${event.outputTokens} out`);
                break;

              case "done":
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
                setReasoningContent("");
                setIsReasoningStreaming(false);
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
      console.error("[ChatPanelKairos] Error:", err);
      setError((err as Error).message || "Erro desconhecido");
    } finally {
      setIsStreaming(false);
      setAgentStatus(null);
      setIsReasoningStreaming(false);
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

  // Audio Recording Functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await handleTranscribe(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Erro ao acessar microfone. Verifique as permissões do navegador.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsTranscribing(true);
    }
  };

  const handleTranscribe = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");

      const res = await fetch("/api/ai/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Falha na transcrição do áudio");
      }

      const data = await res.json();
      if (data.text) {
        setInput((prev) => (prev ? prev + " " + data.text : data.text));
        textareaRef.current?.focus();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao transcrever áudio.";
      setError(message);
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const isEmptyState =
    messages.length === 0 ||
    (messages.length === 1 && messages[0].content === KAIROS_STARTER_MESSAGE);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-violet-950/10 via-background to-background">
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
                className="text-center space-y-6 max-w-xl"
              >
                {/* Mystical icon cluster */}
                <div className="relative inline-flex items-center justify-center">
                  <div className="absolute inset-0 blur-2xl bg-violet-500/20 rounded-full" />
                  <div className="relative flex items-center gap-2">
                    <Star className="w-6 h-6 text-amber-400/60" />
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
                      <Moon className="w-10 h-10 text-violet-400" />
                    </div>
                    <Star className="w-6 h-6 text-amber-400/60" />
                  </div>
                </div>
                <div className="prose prose-invert prose-sm">
                  <MarkdownRenderer content={KAIROS_STARTER_MESSAGE} />
                </div>
              </motion.div>
            ) : (
              messages
                .filter((m) => m.content !== KAIROS_STARTER_MESSAGE)
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
                          "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                          message.role === "assistant"
                            ? "bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30"
                            : "bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30"
                        )}
                      >
                        {message.role === "assistant" ? (
                          <Sparkles className="w-4 h-4 text-violet-400" />
                        ) : (
                          <User className="w-4 h-4 text-amber-400" />
                        )}
                      </div>

                      {/* Message Content */}
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-3",
                          message.role === "assistant"
                            ? "bg-white/5 border border-white/10"
                            : "bg-gradient-to-br from-amber-600/80 to-orange-600/80 text-white"
                        )}
                      >
                        <MarkdownRenderer
                          content={message.content || "..."}
                          isUserMessage={message.role === "user"}
                        />
                        {message.streaming && (
                          <div className="flex items-center gap-2 text-xs text-violet-400/70 mt-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>{agentStatus || "Escrevendo..."}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tool Calls for this message */}
                    {message.toolCalls && message.toolCalls.length > 0 && (
                      <div className="ml-12">
                        <ToolExecutionGroup tools={message.toolCalls} title="O que consultei para você" />
                      </div>
                    )}
                  </motion.div>
                ))
            )}
          </AnimatePresence>
        )}

        {/* Reasoning Card (Thinking visible) */}
        <AnimatePresence>
          {(reasoningContent || isReasoningStreaming) && (
            <div className="ml-12">
              <KairosThinkingCard
                content={reasoningContent}
                isStreaming={isReasoningStreaming}
              />
            </div>
          )}
        </AnimatePresence>

        {/* Agent Status Indicator */}
        <AnimatePresence>
          {agentStatus && !isEmptyState && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="ml-12"
            >
              <KairosStatusIndicator status={agentStatus} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Current Tool Calls (while streaming) */}
        {currentToolCalls.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="ml-12"
          >
            <ToolExecutionGroup tools={currentToolCalls} title="Estou consultando..." />
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-violet-500/10 p-4 md:p-6 bg-gradient-to-t from-violet-950/10 via-background/95 to-transparent backdrop-blur-xl">
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
              placeholder={isRecording ? "🎙️ Gravando áudio..." : isTranscribing ? "✨ Transcrevendo..." : "Compartilhe o que está em seu coração..."}
              className={cn(
                "min-h-[56px] max-h-[200px] resize-none",
                "text-[15px] leading-relaxed",
                "bg-white/5 border-violet-500/20 focus:border-violet-500/50",
                "rounded-xl pr-12",
                "placeholder:text-violet-400/40",
                isRecording && "border-red-500/50 bg-red-500/5"
              )}
              disabled={isStreaming || isRecording || isTranscribing}
            />
            {input.length > 0 && !isRecording && !isTranscribing && (
              <div className="absolute bottom-3 right-3 text-xs text-violet-400/40">
                {input.length}
              </div>
            )}
            {isRecording && (
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
                <span className="text-xs text-red-400">Gravando</span>
              </div>
            )}
          </div>

          {/* Audio Recording Button */}
          <Button
            onClick={toggleRecording}
            disabled={isStreaming || isTranscribing}
            size="icon"
            className={cn(
              "h-[56px] w-[56px] rounded-xl",
              "transition-all duration-300",
              "flex items-center justify-center",
              isRecording
                ? "bg-red-500/20 border-2 border-red-500/50 hover:bg-red-500/30"
                : "bg-white/5 border border-violet-500/20 hover:bg-violet-500/10 hover:border-violet-500/30"
            )}
            title={isRecording ? "Parar gravação" : "Gravar áudio (Whisper)"}
          >
            {isTranscribing ? (
              <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
            ) : isRecording ? (
              <Square className="h-5 w-5 text-red-400 fill-red-400" />
            ) : (
              <Mic className="h-5 w-5 text-violet-400" />
            )}
          </Button>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={isStreaming || !input.trim() || isRecording || isTranscribing}
            size="icon"
            className={cn(
              "h-[56px] w-[56px] rounded-xl",
              "bg-gradient-to-br from-violet-600 to-fuchsia-600",
              "hover:from-violet-500 hover:to-fuchsia-500",
              "shadow-lg shadow-violet-500/25",
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
        <p className="text-xs text-violet-400/40 text-center mt-3">
          <kbd className="px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20">
            Enter
          </kbd>{" "}
          para enviar •{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20">
            Shift+Enter
          </kbd>{" "}
          nova linha •{" "}
          <span className="inline-flex items-center gap-1">
            <Mic className="h-3 w-3" /> áudio via Whisper
          </span>
        </p>
      </div>
    </div>
  );
}

function generateId() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export default ChatPanelKairos;

