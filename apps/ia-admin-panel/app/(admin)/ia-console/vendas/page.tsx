import { ChatWithHistoryVendas } from "@/components/chat/chat-with-history-vendas";
import { Receipt, TrendingUp, Users, RefreshCw } from "lucide-react";

export const metadata = {
  title: "IA Console Vendas - TomikOS Admin",
  description: "Console de vendas com IA integrado à plataforma Ticto",
};

export default function IaConsoleVendasPage() {
  const enabled =
    process.env.NEXT_PUBLIC_FEATURE_IA_CONSOLE_VENDAS === "true" ||
    process.env.FEATURE_IA_CONSOLE_VENDAS === "true";

  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-6rem)] border border-white/10 rounded-2xl text-center space-y-8 bg-gradient-to-br from-background to-emerald-950/20 p-8">
        {/* Icon */}
        <div className="relative">
          <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl animate-pulse" />
          <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
            <Receipt className="w-10 h-10 text-emerald-400" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <p className="text-xs tracking-[0.4em] uppercase text-emerald-400/80 font-medium">
            Integração Ticto
          </p>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-200 to-teal-200 bg-clip-text text-transparent">
            IA Console Vendas
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Console de vendas com IA integrado à plataforma Ticto para consultar
            pedidos, assinaturas e métricas em tempo real.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
          <FeatureCard
            icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
            title="Métricas de Vendas"
            description="Resumo de faturamento e comissões"
          />
          <FeatureCard
            icon={<Users className="w-5 h-5 text-teal-400" />}
            title="Busca de Clientes"
            description="Por email, CPF/CNPJ ou pedido"
          />
          <FeatureCard
            icon={<RefreshCw className="w-5 h-5 text-cyan-400" />}
            title="Assinaturas"
            description="Controle de recorrência e MRR"
          />
        </div>

        {/* Enable Instructions */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 max-w-md">
          <p className="text-sm text-muted-foreground">
            Para habilitar, defina as variáveis de ambiente:
          </p>
          <div className="mt-2 space-y-1">
            <code className="block bg-black/30 rounded-lg px-4 py-2 text-sm font-mono text-emerald-300">
              FEATURE_IA_CONSOLE_VENDAS=true
            </code>
            <code className="block bg-black/30 rounded-lg px-4 py-2 text-sm font-mono text-emerald-300">
              TICTO_CLIENT_ID=your_client_id
            </code>
            <code className="block bg-black/30 rounded-lg px-4 py-2 text-sm font-mono text-emerald-300">
              TICTO_CLIENT_SECRET=your_secret
            </code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] space-y-4">
      {/* Header */}
      <header className="space-y-1 shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                IA Console Vendas
              </h1>
              <p className="text-xs text-muted-foreground">
                Integração Ticto • Pedidos • Assinaturas
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Ticto Conectado
          </span>
        </div>
      </header>

      {/* Chat */}
      <div className="flex-1 min-h-0">
        <ChatWithHistoryVendas />
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 text-left">
      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
        {icon}
      </div>
      <h3 className="font-medium text-foreground text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

