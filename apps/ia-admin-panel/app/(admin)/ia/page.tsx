import { ChatWithHistory } from "@/components/chat/chat-with-history";

export const metadata = {
  title: "Mentora Kairos • IA"
};

export default function IaPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] space-y-6">
      <header className="space-y-2 shrink-0">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">IA Kairos</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Mentora de Human Design
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Converse com a IA especializada em Human Design. Ela considera seu tipo, estratégia,
          autoridade e memórias recentes para propor microações práticas.
        </p>
      </header>
      <div className="flex-1 min-h-0">
        <ChatWithHistory />
      </div>
    </div>
  );
}

