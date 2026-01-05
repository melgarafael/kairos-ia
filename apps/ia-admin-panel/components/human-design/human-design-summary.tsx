import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { HumanDesignTypeBadge } from "./human-design-type-badge";
import { resolveTypeMeta } from "./type-meta";

type Props = {
  tipo?: string | null;
  estrategia?: string | null;
  autoridade?: string | null;
  perfil?: string | null;
  cruz_incarnacao?: string | null;
};

export function HumanDesignSummary(props: Props) {
  const meta = resolveTypeMeta(props.tipo);

  return (
    <Card className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <CardTitle className="text-xl">Meu Design Humano</CardTitle>
          <CardDescription>Resumo rápido para alinhamento diário</CardDescription>
        </div>
        <HumanDesignTypeBadge type={props.tipo} />
      </div>

      <dl className="grid gap-4 md:grid-cols-2 text-sm">
        <InfoItem label="Estratégia" value={props.estrategia} accentClass={meta.accentClass} />
        <InfoItem label="Autoridade" value={props.autoridade} accentClass={meta.accentClass} />
        <InfoItem label="Perfil" value={props.perfil} accentClass={meta.accentClass} />
        <InfoItem label="Cruz de encarnação" value={props.cruz_incarnacao} accentClass={meta.accentClass} />
      </dl>
    </Card>
  );
}

function InfoItem({
  label,
  value,
  accentClass
}: {
  label: string;
  value?: string | null;
  accentClass: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={`text-base font-medium ${accentClass}`}>
        {value?.trim() || "—"}
      </p>
    </div>
  );
}

