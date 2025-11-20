import { ChatWithHistory } from "@/components/chat/chat-with-history";

export const metadata = {
  title: "IA Console"
};

export default function ChatPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] space-y-6">
      {/* Hero Header - Simplicidade Jobsiana */}
      <header className="space-y-2 shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          IA Console
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Comande sua operação com linguagem natural.
        </p>
      </header>
      <div className="flex-1 min-h-0">
        <ChatWithHistory />
      </div>
    </div>
  );
}
