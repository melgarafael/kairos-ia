import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Props = {
  canais?: string[] | null;
  portas?: string[] | null;
};

export function HumanDesignChannelsList({ canais, portas }: Props) {
  const hasContent = (canais && canais.length > 0) || (portas && portas.length > 0);

  return (
    <Card className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <CardTitle>Canais & Portas</CardTitle>
          <CardDescription>Mapa rápido das conexões</CardDescription>
        </div>
      </div>

      {!hasContent ? (
        <p className="text-sm text-muted-foreground">Adicione canais ou portas para ver aqui.</p>
      ) : (
        <div className="space-y-3">
          {canais && canais.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Canais</p>
              <div className="flex flex-wrap gap-2">
                {canais.map((canal) => (
                  <Badge key={canal} variant="secondary" className="bg-purple-500/10 text-purple-50 border border-purple-500/30">
                    {canal}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {portas && portas.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Portas</p>
              <div className="flex flex-wrap gap-2">
                {portas.map((porta) => (
                  <Badge key={porta} variant="outline" className="border-slate-600/50 text-slate-100">
                    {porta}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

