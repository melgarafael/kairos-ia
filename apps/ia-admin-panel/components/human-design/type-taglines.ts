/**
 * Taglines humanizadas por tipo de Human Design
 * Filosofia Jobsiana: comunicação emocional, não técnica
 */

type TypeKey = "manifestor" | "generator" | "manifesting generator" | "projector" | "reflector";

type TypeTagline = {
  headline: string;
  subline: string;
  essence: string;
};

export const TYPE_TAGLINES: Record<TypeKey, TypeTagline> = {
  manifestor: {
    headline: "Nascido para iniciar",
    subline: "Sua energia abre caminhos onde outros veem paredes",
    essence: "Você é o faísca que acende movimentos. Informar antes de agir é sua chave para fluir sem resistência.",
  },
  generator: {
    headline: "Energia vital magnética",
    subline: "Quando você faz o que ama, o universo conspira a seu favor",
    essence: "Sua resposta sacral é seu GPS interno. Espere por algo que acenda seu fogo antes de se comprometer.",
  },
  "manifesting generator": {
    headline: "Velocidade com propósito",
    subline: "Múltiplas paixões, uma energia inesgotável",
    essence: "Você é feito para experimentar e pivotar. Confie no seu sacral e informe enquanto se move.",
  },
  projector: {
    headline: "Guia natural",
    subline: "Você enxerga o que outros não conseguem ver",
    essence: "Sua sabedoria é seu superpoder. Espere pelo convite certo e você guiará com maestria.",
  },
  reflector: {
    headline: "Espelho da comunidade",
    subline: "Sua sensibilidade é um dom raro e precioso",
    essence: "Você reflete a saúde do seu ambiente. Dê-se tempo — 28 dias — para decisões importantes.",
  },
};

export function getTypeTagline(rawType?: string | null): TypeTagline {
  if (!rawType) {
    return {
      headline: "Seu design único",
      subline: "Descubra quem você realmente é",
      essence: "Cada pessoa tem um design único. Complete seu perfil para descobrir o seu.",
    };
  }

  const normalized = normalizeType(rawType);
  if (normalized && TYPE_TAGLINES[normalized]) {
    return TYPE_TAGLINES[normalized];
  }

  return {
    headline: rawType,
    subline: "Seu tipo energético único",
    essence: "Explore seu design para entender melhor como você funciona.",
  };
}

function normalizeType(value: string): TypeKey | null {
  const v = value.toLowerCase().trim();
  if (v === "mg" || v === "manifesting generator") return "manifesting generator";
  if (v === "generator") return "generator";
  if (v === "manifestor") return "manifestor";
  if (v === "projector") return "projector";
  if (v === "reflector") return "reflector";
  return null;
}
