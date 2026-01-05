"use client";

import { useState } from "react";
import { ChatPanelKairos } from "./chat-panel-kairos";
import { ChatSidebar } from "./chat-sidebar";

export function ChatWithHistory() {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  return (
    <div className="flex h-[calc(100vh-8rem)] border border-violet-500/20 rounded-xl overflow-hidden bg-gradient-to-br from-violet-950/5 via-background to-background shadow-lg shadow-violet-500/5">
      <ChatSidebar 
        currentSessionId={currentSessionId} 
        onSelectSession={setCurrentSessionId}
        className="hidden md:flex w-80 border-r border-violet-500/10"
      />
      <div className="flex-1 relative">
        <div className="absolute inset-0 overflow-hidden">
          {/* ChatPanelKairos with streaming magic */}
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-hidden">
              <ChatPanelKairos 
                sessionId={currentSessionId} 
                onSessionCreated={setCurrentSessionId} 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

