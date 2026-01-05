"use client";

import { HumanDesignHero } from "./human-design-hero";
import { DesignAccordion } from "./design-accordion";
import { BodygraphChart } from "./bodygraph";

type PlanetData = {
  Gate: number;
  Line: number;
  Color?: number;
  Tone?: number;
  Base?: number;
  FixingState?: string;
};

type Props = {
  profile: {
    tipo: string | null;
    estrategia: string | null;
    autoridade: string | null;
    perfil: string | null;
    cruz_incarnacao: string | null;
    definicao?: string | null;
    assinatura?: string | null;
    tema_nao_self?: string | null;
    digestao?: string | null;
    sentido?: string | null;
    sentido_design?: string | null;
    motivacao?: string | null;
    perspectiva?: string | null;
    ambiente?: string | null;
    centros_definidos: string[] | null;
    centros_abertos: string[] | null;
    canais: string[] | null;
    portas: string[] | null;
    variaveis?: Record<string, string> | null;
    planetas_personalidade?: Record<string, PlanetData> | null;
    planetas_design?: Record<string, PlanetData> | null;
    data_nascimento_utc?: string | null;
    data_design_utc?: string | null;
    // Chart visualization from API
    chart_url?: string | null;
    bodygraph_svg?: string | null;
  };
  userName?: string;
  birthInfo?: string;
};

/**
 * Full Design View - Redesigned with Jobsian philosophy
 * 
 * Structure:
 * 1. Hero section with emotional impact (type + tagline)
 * 2. Bodygraph Chart as visual centerpiece (when available)
 * 3. Accordion for progressive disclosure of details
 * 
 * UX Philosophy:
 * - First 10 seconds: Hero creates emotional connection
 * - Visual Impact: The bodygraph is THE artifact, prominently displayed
 * - Progressive Disclosure: Details hidden in accordion, not overwhelming
 */
export function FullDesignView({ profile, userName, birthInfo }: Props) {
  const hasData = 
    (profile.centros_definidos && profile.centros_definidos.length > 0) ||
    (profile.portas && profile.portas.length > 0);

  return (
    <div className="space-y-8">
      {/* Hero - First 10 seconds impact */}
      <HumanDesignHero
        tipo={profile.tipo}
        birthDate={birthInfo}
        userName={userName}
      />

      {/* Interactive Bodygraph Chart */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.25em] text-white/40">
            Seu Mapa
          </h2>
          {!hasData && (
            <span className="text-[10px] text-white/30 italic">
              Edite seus dados para gerar o gráfico
            </span>
          )}
        </div>
        
        <BodygraphChart
          tipo={profile.tipo || ""}
          centros_definidos={profile.centros_definidos || []}
          centros_abertos={profile.centros_abertos || []}
          canais={profile.canais || []}
          portas={profile.portas || []}
          planetas_personalidade={profile.planetas_personalidade || undefined}
          planetas_design={profile.planetas_design || undefined}
          showGates={true}
          showChannels={true}
          enableZoom={true}
          className="max-w-2xl mx-auto"
        />
      </section>

      {/* Progressive disclosure via accordion */}
      <DesignAccordion
        profile={{
          tipo: profile.tipo,
          estrategia: profile.estrategia,
          autoridade: profile.autoridade,
          perfil: profile.perfil,
          cruz_incarnacao: profile.cruz_incarnacao,
          definicao: profile.definicao,
          assinatura: profile.assinatura,
          tema_nao_self: profile.tema_nao_self,
          digestao: profile.digestao,
          sentido: profile.sentido,
          sentido_design: profile.sentido_design,
          motivacao: profile.motivacao,
          perspectiva: profile.perspectiva,
          ambiente: profile.ambiente,
          centros_definidos: profile.centros_definidos,
          centros_abertos: profile.centros_abertos,
          canais: profile.canais,
          portas: profile.portas,
          variaveis: profile.variaveis,
          planetas_personalidade: profile.planetas_personalidade,
          planetas_design: profile.planetas_design,
        }}
      />
    </div>
  );
}
