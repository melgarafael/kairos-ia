import { getCurrentUser } from "@/lib/auth/get-session";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChartLine, Cpu, ShieldCheck } from "lucide-react";

const pillars = [
  {
    title: "Status em tempo real",
    description: "Conexões Supabase, tokens ativos e filas MCP.",
    icon: <ChartLine className="text-chart-1" />,
    href: "/admin"
  },
  {
    title: "IA como copiloto",
    description: "Chat GPT-5.1 + MCP para executar ações críticas.",
    icon: <Cpu className="text-chart-2" />,
    href: "/admin/chat"
  },
  {
    title: "Segurança total",
    description: "Auditoria, rate limit e RLS ativados por padrão.",
    icon: <ShieldCheck className="text-chart-3" />,
    href: "/admin/security"
  }
];

export default async function AdminHome() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <p className="text-sm uppercase tracking-[0.4em] text-muted-foreground">
          Hoje
        </p>
        <h1 className="text-4xl font-semibold">
          Bem-vindo(a), {user?.user_metadata?.name ?? user?.email}
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Este é o cockpit interno do TomikOS. Controle usuários, planos e tokens em poucos cliques,
          com a IA tomando as ações por você.
        </p>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/admin/chat">Abrir IA Command Console</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/admin/security">Ver auditoria</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {pillars.map((pillar) => (
          <Card key={pillar.title} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-white/5 flex items-center justify-center">
                {pillar.icon}
              </div>
              <CardTitle>{pillar.title}</CardTitle>
            </div>
            <CardDescription>{pillar.description}</CardDescription>
            <Button variant="ghost" className="px-0" asChild>
              <Link href={pillar.href}>Explorar →</Link>
            </Button>
          </Card>
        ))}
      </section>
    </div>
  );
}

