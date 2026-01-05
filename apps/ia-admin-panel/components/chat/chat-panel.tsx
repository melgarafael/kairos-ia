"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui/cn";
import { Send, Loader2, AlertCircle, Paperclip, X, Mic, Square } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { MarkdownRenderer } from "./markdown-renderer";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

const starterMessage = "Olá! Sou a Kairos, sua mentora de Human Design. 🌟\n\nPosso te ajudar a entender seu design, fazer check-ins diários e propor ações práticas alinhadas com quem você realmente é.\n\nComo posso te ajudar hoje?";

interface ChatPanelProps {
  sessionId: string | null;
  onSessionCreated: (id: string) => void;
}

export function ChatPanel({ sessionId, onSessionCreated }: ChatPanelProps) {
  const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const supabase = createSupabaseBrowserClient();

  const [messages, setMessages] = useState<Message[]>([
    { 
      id: generateId(), 
      role: "assistant", 
      content: starterMessage,
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<{ name: string; type: string; content: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Load messages when sessionId changes
  useEffect(() => {
    async function loadSession() {
      if (!sessionId) {
        setMessages([{ 
          id: generateId(), 
          role: "assistant", 
          content: starterMessage,
          timestamp: Date.now()
        }]);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from("ai_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (data && !error) {
        if (data.length === 0) {
           setMessages([{ 
            id: generateId(), 
            role: "assistant", 
            content: starterMessage,
            timestamp: Date.now()
          }]);
        } else {
          setMessages(data.map(m => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            timestamp: new Date(m.created_at).getTime()
          })));
        }
      }
      setLoading(false);
    }

    loadSession();
  }, [sessionId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-focus textarea
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function handleSend() {
    if ((!input.trim() && !attachment) || loading) return;
    setError(null);
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: (input.trim() ? input.trim() + "\n\n" : "") + (attachment ? `[Anexo: ${attachment.name}]` : ""),
      timestamp: Date.now()
    };
    const optimisticMessages = [...messages, userMessage];
    setMessages(optimisticMessages);
    setInput("");
    const currentAttachment = attachment;
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setLoading(true);

    try {
      const res = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: optimisticMessages, 
          sessionId,
          attachment: currentAttachment
        })
      });
      if (!res.ok) {
        throw new Error((await res.json()).error ?? "Falha na comunicação com a IA.");
      }
      const data = (await res.json()) as { reply: string, sessionId: string };
      
      // If new session was created, notify parent
      if (!sessionId && data.sessionId) {
        onSessionCreated(data.sessionId);
      }

      setMessages((prev) => [
        ...prev,
        { 
          id: generateId(), 
          role: "assistant", 
          content: data.reply,
          timestamp: Date.now()
        }
      ]);
    } catch (err: any) {
      setError(err?.message ?? "Erro desconhecido");
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setAttachment({
        name: file.name,
        type: file.type,
        content
      });
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleTranscribe(audioBlob);
        
        stream.getTracks().forEach(track => track.stop());
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

  const handleTranscribe = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');

      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Falha na transcrição");
      }
      
      const data = await res.json();
      if (data.text) {
        setInput(prev => (prev ? prev + " " + data.text : data.text));
      }
    } catch (err: any) {
      setError(err.message || "Erro ao transcrever áudio.");
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

  const isEmptyState = messages.length === 0 || (messages.length === 1 && messages[0].content === starterMessage);

  return (
    <div>
      {/* Main Chat - Hero Content */}
      <section className="glass-panel rounded-2xl border border-white/5 flex flex-col h-[calc(100vh-12rem)] overflow-hidden">
        {/* Messages Area - Deferência ao conteúdo */}
        <div className={cn(
          "flex-1 overflow-y-auto px-6 py-6 space-y-4",
          isEmptyState && "flex flex-col justify-center items-center"
        )}>
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
              messages.filter(m => m.content !== starterMessage).map((message) => (
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
                      content={message.content}
                      isUserMessage={message.role === "user"}
                      className="font-[450]" // SF Display weight
                    />
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
          
          {/* Loading indicator */}
          {!isEmptyState && loading && (
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

        {/* Input Area - Hero Action */}
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

          {attachment && (
            <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg w-fit">
              <Paperclip size={14} className="text-muted-foreground" />
              <span className="text-sm text-foreground max-w-[200px] truncate" title={attachment.name}>
                {attachment.name}
              </span>
              <button
                onClick={removeAttachment}
                className="ml-2 p-0.5 hover:bg-white/10 rounded-full text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}
          
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite seu comando..."
                className={cn(
                  "min-h-[52px] max-h-[200px] resize-none",
                  "text-[15px] leading-relaxed",
                  "pr-12"
                )}
                disabled={loading}
              />
              <div className="absolute bottom-3 right-3 text-xs text-muted-foreground/50">
                {input.length > 0 && `${input.length} caracteres`}
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept=".csv,image/*,audio/*"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || !!attachment || isRecording || isTranscribing}
              variant="outline"
              size="icon"
              className={cn(
                "h-[52px] w-[52px] min-w-[52px]",
                "bg-background/50 border-white/10",
                "hover:bg-white/5",
                "transition-all duration-200"
              )}
              title="Anexar arquivo (CSV, Imagem, Áudio)"
            >
              <Paperclip size={20} className="text-muted-foreground" />
            </Button>
            
            <Button
              onClick={toggleRecording}
              disabled={loading || isTranscribing}
              variant="outline"
              size="icon"
              className={cn(
                "h-[52px] w-[52px] min-w-[52px]",
                "bg-background/50 border-white/10",
                "hover:bg-white/5",
                "transition-all duration-200",
                isRecording && "bg-red-500/10 border-red-500/50 hover:bg-red-500/20"
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

            <Button
              onClick={handleSend}
              disabled={loading || (!input.trim() && !attachment) || isRecording || isTranscribing}
              size="lg"
              className={cn(
                "h-[52px] px-6 min-w-[52px]",
                "bg-primary text-primary-foreground",
                "hover:bg-primary/90 shadow-lg shadow-primary/20",
                "transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Send size={20} />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/60 text-center">
            Pressione <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">Enter</kbd> para enviar, <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">Shift+Enter</kbd> para nova linha
          </p>
        </div>
      </section>
    </div>
  );
}

