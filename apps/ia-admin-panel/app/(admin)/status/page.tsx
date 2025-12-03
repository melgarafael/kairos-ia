import { StatusDashboard } from "@/components/status";

export const metadata = {
  title: "Status em tempo real | TomikOS Admin",
  description: "Monitoramento de conexões Supabase, tokens ativos e filas MCP"
};

export default function StatusPage() {
  return <StatusDashboard />;
}

