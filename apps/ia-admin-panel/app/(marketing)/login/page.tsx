import { LoginForm } from "@/components/auth/login-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Entrar • Kairos IA"
};

export default function LoginPage() {
  return (
    <main className="min-h-screen relative overflow-hidden flex items-center justify-center px-6 py-20">
      <div className="absolute inset-0 hero-grid opacity-30" />
      <div className="max-w-xl w-full relative space-y-8">
        <header className="text-center space-y-3">
          <p className="uppercase tracking-[0.3em] text-xs text-muted-foreground">
            Kairos IA • Espaço pessoal
          </p>
          <h1 className="text-4xl font-semibold text-white">
            Entre para alinhar seu dia com seu Design Humano.
          </h1>
          <p className="text-base text-muted-foreground">
            Acesse seu painel, registre seu design e converse com a mentora Kairos.
          </p>
        </header>

        <Card className="glass-panel space-y-6">
          <div className="space-y-2">
            <CardTitle>Login seguro</CardTitle>
            <CardDescription>
              Use seu email cadastrado. Toda sessão é protegida e auditável.
            </CardDescription>
          </div>
          <LoginForm />
        </Card>
      </div>
    </main>
  );
}

