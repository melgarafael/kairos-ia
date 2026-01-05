import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/get-session";
import { getHumanDesignProfile } from "@/lib/kairos/human-design";
import { FullDesignView } from "@/components/human-design/full-design-view";
import { EditButton } from "./edit-button";

export const metadata = {
  title: "Meu Design • Kairos IA"
};

type PlanetData = {
  Gate: number;
  Line: number;
  Color?: number;
  Tone?: number;
  Base?: number;
  FixingState?: string;
};

export default async function MeuDesignPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getHumanDesignProfile(user.id);

  // If no profile, redirect to onboarding
  if (!profile || !profile.tipo) {
    redirect("/onboarding");
  }

  // Extract birth data from raw_data if available
  const rawData = profile.raw_data as Record<string, unknown> | null;
  const birthInfo = rawData?.Properties as Record<string, unknown> | undefined;
  const birthDateLocal = birthInfo?.BirthDateLocal as string | undefined;
  
  // Try to get location info if stored
  const birthLocation = (rawData as Record<string, unknown> | null)?.birthLocation as string | undefined;
  const timezone = (rawData as Record<string, unknown> | null)?.timezone as string | undefined;

  // Build profile object for FullDesignView
  const fullProfile = {
    tipo: profile.tipo,
    estrategia: profile.estrategia,
    autoridade: profile.autoridade,
    perfil: profile.perfil,
    cruz_incarnacao: profile.cruz_incarnacao,
    definicao: (profile as Record<string, unknown>).definicao as string | null | undefined,
    assinatura: (profile as Record<string, unknown>).assinatura as string | null | undefined,
    tema_nao_self: (profile as Record<string, unknown>).tema_nao_self as string | null | undefined,
    digestao: (profile as Record<string, unknown>).digestao as string | null | undefined,
    sentido: (profile as Record<string, unknown>).sentido as string | null | undefined,
    sentido_design: (profile as Record<string, unknown>).sentido_design as string | null | undefined,
    motivacao: (profile as Record<string, unknown>).motivacao as string | null | undefined,
    perspectiva: (profile as Record<string, unknown>).perspectiva as string | null | undefined,
    ambiente: (profile as Record<string, unknown>).ambiente as string | null | undefined,
    centros_definidos: Array.isArray(profile.centros_definidos) ? profile.centros_definidos as string[] : null,
    centros_abertos: Array.isArray(profile.centros_abertos) ? profile.centros_abertos as string[] : null,
    canais: Array.isArray(profile.canais) ? profile.canais as string[] : null,
    portas: Array.isArray(profile.portas) ? profile.portas as string[] : null,
    variaveis: (profile as Record<string, unknown>).variaveis as Record<string, string> | null | undefined,
    planetas_personalidade: (profile as Record<string, unknown>).planetas_personalidade as Record<string, PlanetData> | null | undefined,
    planetas_design: (profile as Record<string, unknown>).planetas_design as Record<string, PlanetData> | null | undefined,
    data_nascimento_utc: (profile as Record<string, unknown>).data_nascimento_utc as string | null | undefined,
    data_design_utc: (profile as Record<string, unknown>).data_design_utc as string | null | undefined,
    // Chart visualization from API
    chart_url: (profile as Record<string, unknown>).chart_url as string | null | undefined,
    bodygraph_svg: (profile as Record<string, unknown>).bodygraph_svg as string | null | undefined,
  };

  // Parse birth date for edit modal
  const parsedBirthDate = parseBirthDateFromApi(birthDateLocal);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header with Edit */}
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-white/40">
            Identidade
          </p>
          <h1 className="text-2xl font-semibold text-white/90">
            Meu Design Humano
          </h1>
          <p className="text-sm text-white/50 max-w-md">
            Seu mapa energético único. A mentora Kairos usa esses dados para personalizar suas orientações.
          </p>
        </div>

        <EditButton
          currentBirthDate={parsedBirthDate?.date}
          currentBirthTime={parsedBirthDate?.time}
          currentLocation={birthLocation}
          currentTimezone={timezone}
        />
      </header>

      {/* Main Content - Clean single column */}
      <FullDesignView
        profile={fullProfile}
        birthInfo={birthDateLocal}
      />

      {/* Subtle info footer */}
      <footer className="pt-6 border-t border-white/5">
        <div className="flex items-start gap-3 text-xs text-white/30">
          <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            Seu design é calculado automaticamente a partir da sua data, hora e local de nascimento.
            Clique em "Editar" para corrigir informações — seu mapa será recalculado instantaneamente.
          </p>
        </div>
      </footer>
    </div>
  );
}

// Helper function to parse API date format
function parseBirthDateFromApi(apiDate?: string): { date: string; time: string } | null {
  if (!apiDate) return null;
  
  try {
    const match = apiDate.match(/(\d+)\w*\s+(\w+)\s+(\d{4})\s+@\s+(\d{1,2}):(\d{2})/);
    if (!match) return null;
    
    const [, day, monthStr, year, hour, minute] = match;
    
    const months: Record<string, string> = {
      January: "01", February: "02", March: "03", April: "04",
      May: "05", June: "06", July: "07", August: "08",
      September: "09", October: "10", November: "11", December: "12",
    };
    
    const month = months[monthStr] || "01";
    const date = `${year}-${month}-${day.padStart(2, "0")}`;
    const time = `${hour.padStart(2, "0")}:${minute}`;
    
    return { date, time };
  } catch {
    return null;
  }
}
