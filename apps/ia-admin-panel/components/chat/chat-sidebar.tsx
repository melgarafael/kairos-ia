"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/ui/cn";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, Clock, User, Shield, Lock } from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

export type ChatSession = {
  id: string;
  title: string;
  user_id: string;
  user_email: string;
  user_role: "founder" | "admin" | "staff";
  created_at: string;
};

interface ChatSidebarProps {
  currentSessionId: string | null;
  onSelectSession: (sessionId: string | null) => void;
  className?: string;
}

export function ChatSidebar({ currentSessionId, onSelectSession, className }: ChatSidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"mine" | "team">("mine");
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

    // Realtime subscription
    const channel = supabase
      .channel('admin_chat_sessions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_chat_sessions'
        },
        () => {
          fetchSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, activeTab]);

  async function fetchSessions() {
    setLoading(true);
    try {
      let query = supabase
        .from("admin_chat_sessions")
        .select("*")
        .order("created_at", { ascending: false });

      if (activeTab === "mine") {
        query = query.eq("user_id", currentUser.id);
      } else {
        // "Team" tab logic handled by RLS, but visually we might want to filter out 'me' if desired.
        // For now, we show what the RLS allows. 
        // Requirements:
        // Founder: See all.
        // Admin: See all except founder.
        // Staff: See own.
        
        // If I am staff, RLS only returns mine anyway.
        // If I am Admin/Founder, I see others.
        // We'll filter OUT current user for "Team" tab to avoid duplication.
        query = query.neq("user_id", currentUser.id);
      }

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

  const canViewTeam = currentUser?.user_metadata?.role === 'admin' || currentUser?.user_metadata?.role === 'founder';

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

        {canViewTeam && (
          <div className="flex bg-muted p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("mine")}
              className={cn(
                "flex-1 text-xs font-medium py-1.5 rounded-md transition-all",
                activeTab === "mine" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Minhas
            </button>
            <button
              onClick={() => setActiveTab("team")}
              className={cn(
                "flex-1 text-xs font-medium py-1.5 rounded-md transition-all",
                activeTab === "team" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Equipe
            </button>
          </div>
        )}
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
                      {activeTab === 'team' && (
                        <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-[10px] text-primary">
                          {session.user_role === 'founder' ? <Lock className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        </span>
                      )}
                      <span className="truncate">{session.title}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="text-xs text-muted-foreground truncate max-w-[140px]">
                         {activeTab === 'team' ? session.user_email : formatDistanceToNow(new Date(session.created_at), { locale: ptBR, addSuffix: true })}
                      </div>
                      {activeTab === 'team' && (
                         <span className={cn(
                           "text-[10px] px-1.5 py-0.5 rounded-full border uppercase font-semibold tracking-wider",
                           session.user_role === 'founder' ? "bg-purple-500/10 text-purple-500 border-purple-500/20" :
                           session.user_role === 'admin' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                           "bg-gray-500/10 text-gray-500 border-gray-500/20"
                         )}>
                           {session.user_role}
                         </span>
                      )}
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

