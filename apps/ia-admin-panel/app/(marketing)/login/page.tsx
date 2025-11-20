import { LoginForm } from "@/components/auth/login-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Entrar • TomikOS Admin"
};

export default function LoginPage() {
  return (
    <main className="min-h-screen relative overflow-hidden flex items-center justify-center px-6 py-20">
      <div className="absolute inset-0 hero-grid opacity-30" />
      <div className="max-w-xl w-full relative space-y-8">
        <header className="text-center space-y-3">
          <p className="uppercase tracking-[0.3em] text-xs text-muted-foreground">
            TomikOS Command Center
          </p>
          <h1 className="text-4xl font-semibold text-white">
            Hoje reinventamos o suporte interno.
          </h1>
          <p className="text-base text-muted-foreground">
            Acesso exclusivo para o time. O futuro do TomikOS começa aqui.
          </p>
        </header>

        <Card className="glass-panel space-y-6">
          <div className="space-y-2">
            <CardTitle>Login seguro</CardTitle>
            <CardDescription>
              Use seu email institucional. Cada sessão é auditada.
            </CardDescription>
          </div>
          <LoginForm />
        </Card>
      </div>
    </main>
  );
}

