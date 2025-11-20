import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Shield, Activity, Lock } from "lucide-react";

const rows = [
  {
    icon: <Shield className="text-chart-1" />,
    title: "RLS + Rate limit",
    description: "Todas as queries passam por Row Level Security e o endpoint IA possui rate limit Upstash."
  },
  {
    icon: <Activity className="text-chart-2" />,
    title: "Auditoria MCP",
    description: "Cada chamada a ferramentas é logada na tabela admin_ai_audit junto do user_id e payload."
  },
  {
    icon: <Lock className="text-chart-3" />,
    title: "Segredos isolados",
    description: "Keys do Supabase e da OpenAI ficam apenas no servidor. Nada exposto ao cliente."
  }
];

export default function SecurityPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Segurança
        </p>
        <h1 className="text-3xl font-semibold">Guardrails ativos</h1>
        <p className="text-muted-foreground">
          Checklist Jobsiano: promessa clara, experiência responsiva e segurança enorme.
        </p>
      </header>
      <div className="grid gap-6 md:grid-cols-3">
        {rows.map((row) => (
          <Card key={row.title} className="space-y-3">
            <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center">
              {row.icon}
            </div>
            <CardTitle>{row.title}</CardTitle>
            <CardDescription>{row.description}</CardDescription>
          </Card>
        ))}
      </div>
    </div>
  );
}

