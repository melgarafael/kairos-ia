import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/ui/cn";

type Props = {
  definidos?: string[] | null;
  abertos?: string[] | null;
};

export function HumanDesignCentersOverview({ definidos, abertos }: Props) {
  const items = [
    ...(definidos ?? []).map((name) => ({ name, state: "definido" as const })),
    ...(abertos ?? []).map((name) => ({ name, state: "aberto" as const }))
  ];

  return (
    <Card className="p-4 md:p-6 space-y-3">
      <header className="flex items-center justify-between">
        <div>
          <CardTitle>Centros</CardTitle>
          <CardDescription>Visualize definidos e abertos</CardDescription>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Cadastre seu design para ver os centros aqui.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <CenterPill key={`${item.state}-${item.name}`} name={item.name} state={item.state} />
          ))}
        </div>
      )}
    </Card>
  );
}

function CenterPill({ name, state }: { name: string; state: "definido" | "aberto" }) {
  const palette =
    state === "definido"
      ? "bg-emerald-500/10 text-emerald-100 border-emerald-500/40"
      : "bg-slate-500/10 text-slate-100 border-slate-500/30";

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium",
        palette
      )}
    >
      <span className="truncate">{name}</span>
      <span className="text-xs uppercase tracking-wide opacity-80">{state}</span>
    </div>
  );
}

