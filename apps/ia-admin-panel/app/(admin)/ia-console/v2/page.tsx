import { ChatWithHistoryV2 } from "@/components/chat/chat-with-history-v2";

export const metadata = {
  title: "IA Console V2"
};

export default function IaConsoleV2Page() {
  const enabled =
    (process.env.NEXT_PUBLIC_FEATURE_IA_CONSOLE_V2 ??
      process.env.FEATURE_IA_CONSOLE_V2) === "true";

  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-6rem)] border rounded-xl text-center space-y-4">
        <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground">Beta fechado</p>
        <h1 className="text-2xl font-semibold text-foreground">IA Console V2 desabilitado</h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          Habilite a variável <code className="px-1 py-0.5 bg-muted rounded">FEATURE_IA_CONSOLE_V2</code> para liberar o
          streaming governado com Responses API + MCP tools.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] space-y-6">
      <header className="space-y-2 shrink-0">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Governance Mode
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">IA Console V2</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Operação com Responses API + MCP tools, streaming em tempo real e histórico auditável.
        </p>
      </header>
      <div className="flex-1 min-h-0">
        <ChatWithHistoryV2 />
      </div>
    </div>
  );
}


