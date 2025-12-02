import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Shield, Activity, Lock, Terminal } from "lucide-react";
import { McpAuditTable } from "@/components/audit/mcp-audit-table";

const guardrails = [
  {
    icon: <Shield className="text-chart-1" />,
    title: "RLS + Rate limit",
    description: "Todas as queries passam por Row Level Security e o endpoint IA possui rate limit Upstash."
  },
  {
    icon: <Activity className="text-chart-2" />,
    title: "Auditoria Granular",
    description: "Cada tool call é logada com argumentos, resultado, tempo de execução e trace ID."
  },
  {
    icon: <Lock className="text-chart-3" />,
    title: "Segredos isolados",
    description: "Keys do Supabase e da OpenAI ficam apenas no servidor. Nada exposto ao cliente."
  },
  {
    icon: <Terminal className="text-chart-4" />,
    title: "Rastreabilidade",
    description: "Todo trace_id permite correlacionar chamadas do início ao fim da sessão."
  }
];

export default function AuditPage() {
  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Segurança & Observabilidade
        </p>
        <h1 className="text-3xl font-semibold">Auditoria MCP</h1>
        <p className="text-muted-foreground max-w-2xl">
          Cada chamada a ferramentas do Model Context Protocol (MCP) é registrada aqui.
          Visualize execuções, tempos de resposta e erros em tempo real.
        </p>
      </header>

      {/* Guardrails */}
      <section className="grid gap-4 md:grid-cols-4">
        {guardrails.map((item) => (
          <Card key={item.title} className="space-y-3">
            <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center">
              {item.icon}
            </div>
            <CardTitle className="text-sm">{item.title}</CardTitle>
            <CardDescription className="text-xs">{item.description}</CardDescription>
          </Card>
        ))}
      </section>

      {/* Audit Table */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-chart-2" />
          <h2 className="text-xl font-semibold">Logs de Tool Calls</h2>
        </div>
        <McpAuditTable />
      </section>
    </div>
  );
}

