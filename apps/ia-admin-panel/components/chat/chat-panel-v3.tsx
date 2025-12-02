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
  Paperclip,
  X,
  Mic,
  Square,
  Image as ImageIcon,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { MarkdownRenderer } from "./markdown-renderer";
import { ToolExecutionGroup, ToolCallData } from "./tool-execution-card";

// Types
interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string; // base64 or text content
  isImage: boolean;
  preview?: string; // For images
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  streaming?: boolean;
  toolCalls?: ToolCallData[];
  attachments?: FileAttachment[];
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
  // New streaming events
  loop?: number;
  totalLoops?: number;
  thinking?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

// Starter message
const STARTER_MESSAGE = `Olá! Sou o **Agente Admin V3** do TomikOS. Posso ajudar você a:

- 🔍 Buscar e gerenciar usuários
- 🎫 Emitir e administrar tokens de licença
- 🏢 Gerenciar organizações
- 📊 Consultar métricas e KPIs
- 📎 Analisar arquivos (CSV, TXT, MD, XLSX, DOCX)
- 🖼️ Interpretar imagens
- 🎤 Entender comandos de voz

Como posso ajudar?`;

// Supported file types
const ACCEPTED_FILE_TYPES = {
  text: [".txt", ".md", ".csv", ".json", ".xml"],
  document: [".docx", ".xlsx"],
  image: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  audio: [".mp3", ".wav", ".webm", ".m4a", ".ogg"],
};

const ALL_ACCEPTED = Object.values(ACCEPTED_FILE_TYPES).flat().join(",");

interface ChatPanelV3Props {
  sessionId: string | null;
  onSessionCreated: (id: string) => void;
}

export function ChatPanelV3({ sessionId, onSessionCreated }: ChatPanelV3Props) {
  const supabase = createSupabaseBrowserClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const skipHydrationRef = useRef(false);
  const sessionRef = useRef<string | null>(sessionId);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: generateId(),
      role: "assistant",
      content: STARTER_MESSAGE,
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCallData[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
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
            attachments: m.metadata?.attachments || undefined,
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
        console.error("[IA Console V3] erro ao carregar histórico", err);
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

  // File handling
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: FileAttachment[] = [];

    for (const file of Array.from(files)) {
      try {
        const isImage = file.type.startsWith("image/");
        const isAudio = file.type.startsWith("audio/");
        
        // Handle audio files - transcribe them
        if (isAudio) {
          await handleAudioFile(file);
          continue;
        }

        const attachment: FileAttachment = {
          id: generateId(),
          name: file.name,
          type: file.type,
          size: file.size,
          content: "",
          isImage,
        };

        if (isImage) {
          // Read as base64 for images
          const base64 = await readFileAsBase64(file);
          attachment.content = base64;
          attachment.preview = base64;
        } else {
          // Read as text for documents
          const content = await readFileContent(file);
          attachment.content = content;
        }

        newAttachments.push(attachment);
      } catch (err) {
        console.error(`Error processing file ${file.name}:`, err);
        setError(`Erro ao processar arquivo ${file.name}`);
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Audio recording
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
      setError("Erro ao acessar microfone. Verifique as permissões.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsTranscribing(true);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleAudioFile = async (file: File) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("file", file, file.name);

      const res = await fetch("/api/ai/transcribe", {
        method: "POST",
        body: formData,
      });

      // Check if response is JSON
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("[Transcribe] Response is not JSON:", contentType);
        throw new Error("Erro de autenticação. Recarregue a página e tente novamente.");
      }

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Falha na transcrição");
      }

      if (data.text) {
        setInput((prev) => (prev ? prev + " " + data.text : data.text));
      }
    } catch (err: unknown) {
      console.error("[Transcribe Audio File] Error:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro ao transcrever áudio.";
      setError(errorMessage);
    } finally {
      setIsTranscribing(false);
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

      // Check if response is JSON
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("[Transcribe] Response is not JSON:", contentType);
        throw new Error("Erro de autenticação. Recarregue a página e tente novamente.");
      }

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Falha na transcrição");
      }

      if (data.text) {
        setInput((prev) => (prev ? prev + " " + data.text : data.text));
      }
    } catch (err: unknown) {
      console.error("[Transcribe] Error:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro ao transcrever áudio.";
      setError(errorMessage);
    } finally {
      setIsTranscribing(false);
    }
  };

  async function handleSend() {
    if ((!input.trim() && attachments.length === 0) || isStreaming) return;

    setError(null);
    setCurrentToolCalls([]);
    setAgentStatus(null);
    setCurrentLoop(null);

    // Build user message content
    let userContent = input.trim();
    if (attachments.length > 0) {
      const attachmentNames = attachments.map((a) => a.name).join(", ");
      if (userContent) {
        userContent += `\n\n📎 Anexos: ${attachmentNames}`;
      } else {
        userContent = `📎 Anexos: ${attachmentNames}`;
      }
    }

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: userContent,
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    const optimisticMessages = [
      ...messages.filter((m) => m.content !== STARTER_MESSAGE),
      userMessage,
    ];
    setMessages(optimisticMessages);
    
    const currentAttachments = [...attachments];
    setInput("");
    setAttachments([]);
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
      const res = await fetch("/api/ia-console-v3/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: optimisticMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          sessionId,
          attachments: currentAttachments.map((a) => ({
            name: a.name,
            type: a.type,
            content: a.content,
            isImage: a.isImage,
          })),
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        // Check if response is JSON
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          console.error("[IA Console V3] Response is not JSON:", contentType);
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
                setAgentStatus(`Consultando modelo ${event.model || "GPT-4.1"}...`);
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
                    category: event.category || "system",
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
                console.log(`[IA Console V3] Tokens: ${event.inputTokens} in, ${event.outputTokens} out`);
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
      console.error("[IA Console V3] Error:", err);
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
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
                  <Sparkles className="w-8 h-8 text-violet-400" />
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
                            ? "bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30"
                            : "bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30"
                        )}
                      >
                        {message.role === "assistant" ? (
                          <Bot className="w-4 h-4 text-violet-400" />
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
                        {/* Attachments preview for user messages */}
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {message.attachments.map((att) =>
                              att.isImage && att.preview ? (
                                <img
                                  key={att.id}
                                  src={att.preview}
                                  alt={att.name}
                                  className="w-20 h-20 object-cover rounded-lg border border-white/20"
                                />
                              ) : (
                                <div
                                  key={att.id}
                                  className="flex items-center gap-1 px-2 py-1 bg-white/10 rounded-lg text-xs"
                                >
                                  <FileText className="w-3 h-3" />
                                  {att.name}
                                </div>
                              )
                            )}
                          </div>
                        )}
                        
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
            className="flex items-center gap-2 text-sm text-violet-400 ml-11"
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

        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl"
              >
                {att.isImage ? (
                  <>
                    {att.preview && (
                      <img
                        src={att.preview}
                        alt={att.name}
                        className="w-8 h-8 object-cover rounded"
                      />
                    )}
                    <ImageIcon className="w-4 h-4 text-violet-400" />
                  </>
                ) : att.type.includes("spreadsheet") || att.name.endsWith(".xlsx") || att.name.endsWith(".csv") ? (
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                ) : (
                  <FileText className="w-4 h-4 text-blue-400" />
                )}
                <span className="text-sm text-foreground max-w-[150px] truncate">
                  {att.name}
                </span>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="ml-1 p-0.5 hover:bg-white/10 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={14} />
                </button>
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
              placeholder="Digite um comando, anexe arquivos ou grave áudio..."
              className={cn(
                "min-h-[56px] max-h-[200px] resize-none",
                "text-[15px] leading-relaxed",
                "bg-white/5 border-white/10 focus:border-violet-500/50",
                "rounded-xl pr-12",
                "placeholder:text-muted-foreground/50"
              )}
              disabled={isStreaming || isTranscribing}
            />
            {input.length > 0 && (
              <div className="absolute bottom-3 right-3 text-xs text-muted-foreground/40">
                {input.length}
              </div>
            )}
          </div>

          {/* File Input (hidden) */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept={ALL_ACCEPTED}
            multiple
          />

          {/* Attachment Button */}
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming || isTranscribing}
            variant="outline"
            size="icon"
            className={cn(
              "h-[56px] w-[56px] rounded-xl",
              "bg-white/5 border-white/10",
              "hover:bg-white/10 hover:border-violet-500/30",
              "transition-all duration-200"
            )}
            title="Anexar arquivo (CSV, TXT, MD, DOCX, XLSX, Imagens)"
          >
            <Paperclip size={20} className="text-muted-foreground" />
          </Button>

          {/* Audio Recording Button */}
          <Button
            onClick={toggleRecording}
            disabled={isStreaming || isTranscribing}
            variant="outline"
            size="icon"
            className={cn(
              "h-[56px] w-[56px] rounded-xl",
              "bg-white/5 border-white/10",
              "hover:bg-white/10 hover:border-violet-500/30",
              "transition-all duration-200",
              isRecording && "bg-red-500/20 border-red-500/50 hover:bg-red-500/30"
            )}
            title={isRecording ? "Parar gravação" : "Gravar áudio"}
          >
            {isTranscribing ? (
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            ) : isRecording ? (
              <Square size={20} className="text-red-500 fill-current" />
            ) : (
              <Mic size={20} className="text-muted-foreground" />
            )}
          </Button>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={isStreaming || isTranscribing || (!input.trim() && attachments.length === 0)}
            size="icon"
            className={cn(
              "h-[56px] w-[56px] rounded-xl",
              "bg-blue-600 hover:bg-blue-500",
              "shadow-lg shadow-blue-500/25",
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

async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function readFileContent(file: File): Promise<string> {
  // For XLSX and DOCX, we need special handling
  const extension = file.name.split(".").pop()?.toLowerCase();
  
  if (extension === "xlsx" || extension === "docx") {
    // Read as base64 for server-side processing
    return readFileAsBase64(file);
  }
  
  // For text files, read as text
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
