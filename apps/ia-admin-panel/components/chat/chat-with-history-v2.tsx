"use client";

import { useState } from "react";
import { ChatPanelV2 } from "./chat-panel-v2";
import { ChatSidebar } from "./chat-sidebar";

export function ChatWithHistoryV2() {
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
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-hidden">
              <ChatPanelV2 sessionId={currentSessionId} onSessionCreated={setCurrentSessionId} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



