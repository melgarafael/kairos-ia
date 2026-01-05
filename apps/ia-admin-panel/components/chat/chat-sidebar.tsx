"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/ui/cn";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, Clock } from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

export type ChatSession = {
  id: string;
  title: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

interface ChatSidebarProps {
  currentSessionId: string | null;
  onSelectSession: (sessionId: string | null) => void;
  className?: string;
}

export function ChatSidebar({ currentSessionId, onSelectSession, className }: ChatSidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseBrowserClient();
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    }
    fetchUser();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    fetchSessions();

    const channel = supabase
      .channel("ai_sessions_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ai_sessions"
        },
        () => {
          fetchSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  async function fetchSessions() {
    setLoading(true);
    try {
      let query = supabase
        .from("ai_sessions")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("updated_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setSessions((data as ChatSession[]) || []);
    } catch (err) {
      console.error("Error loading sessions:", err);
    } finally {
      setLoading(false);
    }
  }

  // Grouping logic
  const groupedSessions = sessions.reduce((acc, session) => {
    const date = new Date(session.created_at);
    let key = "Antigos";
    if (isToday(date)) key = "Hoje";
    else if (isYesterday(date)) key = "Ontem";
    
    if (!acc[key]) acc[key] = [];
    acc[key].push(session);
    return acc;
  }, {} as Record<string, ChatSession[]>);

  const groups = ["Hoje", "Ontem", "Antigos"].filter(key => groupedSessions[key]?.length > 0);

  return (
    <div className={cn("flex flex-col h-full border-r bg-muted/10 w-80", className)}>
      <div className="p-4 space-y-4">
        <Button 
          className="w-full justify-start gap-2 bg-primary/10 text-primary hover:bg-primary/20 border-0" 
          variant="outline"
          onClick={() => onSelectSession(null)}
        >
          <Plus className="w-4 h-4" />
          Nova Conversa
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-6">
        {loading ? (
          <div className="space-y-3 px-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-20" />
            <p>Nenhuma conversa encontrada.</p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group} className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground px-2 uppercase tracking-wider">
                {group}
              </h3>
              <div className="space-y-1">
                {groupedSessions[group].map(session => (
                  <button
                    key={session.id}
                    onClick={() => onSelectSession(session.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg text-sm transition-all group hover:bg-accent/50 border border-transparent",
                      currentSessionId === session.id ? "bg-accent border-border shadow-sm" : "hover:border-border/50"
                    )}
                  >
                    <div className="font-medium truncate pr-4 flex items-center gap-2">
                      <span className="truncate">{session.title}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="text-xs text-muted-foreground truncate max-w-[140px]">
                        {formatDistanceToNow(new Date(session.updated_at ?? session.created_at), { locale: ptBR, addSuffix: true })}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

