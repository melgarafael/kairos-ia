"use client";

import { useState } from "react";
import { ChatPanelMemberkit } from "./chat-panel-memberkit";
import { ChatSidebar } from "./chat-sidebar";

export function ChatWithHistoryMemberkit() {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  return (
    <div className="flex h-[calc(100vh-8rem)] border border-white/10 rounded-2xl overflow-hidden bg-gradient-to-br from-background via-background to-emerald-950/10 shadow-2xl shadow-emerald-500/5">
      {/* Sidebar */}
      <ChatSidebar
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
        className="hidden md:flex w-80 border-r border-white/10 bg-black/20"
      />
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gradient-to-b from-transparent to-black/10 relative overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-teal-500/5 via-transparent to-transparent pointer-events-none" />
        
        {/* Content */}
        <div className="relative flex-1 flex flex-col overflow-hidden">
          <ChatPanelMemberkit 
            sessionId={currentSessionId} 
            onSessionCreated={setCurrentSessionId} 
          />
        </div>
      </div>
    </div>
  );
}

