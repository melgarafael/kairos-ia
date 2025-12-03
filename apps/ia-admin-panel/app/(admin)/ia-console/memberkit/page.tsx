import { ChatWithHistoryMemberkit } from "@/components/chat/chat-with-history-memberkit";
import { GraduationCap, Users, BookOpen, MessageSquare } from "lucide-react";

export const metadata = {
  title: "IA Console Memberkit - Acessos",
  description: "Console de gestão de acessos Memberkit com IA, streaming em tempo real e 26 ferramentas",
};

export default function IaConsoleMemberkitPage() {
  const enabled =
    process.env.NEXT_PUBLIC_FEATURE_IA_CONSOLE_MEMBERKIT === "true" ||
    process.env.FEATURE_IA_CONSOLE_MEMBERKIT === "true";

  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-6rem)] border border-white/10 rounded-2xl text-center space-y-8 bg-gradient-to-br from-background to-emerald-950/20 p-8">
        {/* Icon */}
        <div className="relative">
          <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl animate-pulse" />
          <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
            <GraduationCap className="w-10 h-10 text-emerald-400" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <p className="text-xs tracking-[0.4em] uppercase text-emerald-400/80 font-medium">
            Gestão de Acessos
          </p>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-200 to-teal-200 bg-clip-text text-transparent">
            IA Console Memberkit
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Console inteligente para gestão de membros, cursos, assinaturas e gamificação
            na plataforma Memberkit.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 max-w-3xl">
          <FeatureCard
            icon={<Users className="w-5 h-5 text-blue-400" />}
            title="Membros"
            description="Gestão completa de alunos"
          />
          <FeatureCard
            icon={<BookOpen className="w-5 h-5 text-amber-400" />}
            title="Cursos"
            description="Consulta de progresso"
          />
          <FeatureCard
            icon={<MessageSquare className="w-5 h-5 text-violet-400" />}
            title="Comentários"
            description="Moderação inteligente"
          />
          <FeatureCard
            icon={<GraduationCap className="w-5 h-5 text-emerald-400" />}
            title="26 Tools"
            description="Integração completa"
          />
        </div>

        {/* Enable Instructions */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 max-w-md">
          <p className="text-sm text-muted-foreground">
            Para habilitar, defina as variáveis de ambiente:
          </p>
          <code className="mt-2 block bg-black/30 rounded-lg px-4 py-2 text-sm font-mono text-emerald-300">
            FEATURE_IA_CONSOLE_MEMBERKIT=true
          </code>
          <code className="mt-1 block bg-black/30 rounded-lg px-4 py-2 text-sm font-mono text-emerald-300">
            MEMBERKIT_API_KEY=sua_api_key
          </code>
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
              <GraduationCap className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                IA Console Memberkit
              </h1>
              <p className="text-xs text-muted-foreground">
                Acessos • Membros • Cursos • Gamificação
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Online
          </span>
        </div>
      </header>

      {/* Chat */}
      <div className="flex-1 min-h-0">
        <ChatWithHistoryMemberkit />
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

