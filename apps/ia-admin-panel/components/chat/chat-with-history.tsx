"use client";

import { useState } from "react";
import { ChatPanel } from "./chat-panel";
import { ChatSidebar } from "./chat-sidebar";

export function ChatWithHistory() {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  return (
    <div className="flex h-[calc(100vh-8rem)] border rounded-xl overflow-hidden bg-background shadow-sm">
      <ChatSidebar 
        currentSessionId={currentSessionId} 
        onSelectSession={setCurrentSessionId}
        className="hidden md:flex w-80 border-r"
      />
      <div className="flex-1 bg-background/50 backdrop-blur-sm relative">
        <div className="absolute inset-0 overflow-hidden">
            {/* We wrap ChatPanel to give it full height control */}
            <div className="h-full flex flex-col">
                <div className="flex-1 overflow-hidden">
                    <ChatPanel 
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

