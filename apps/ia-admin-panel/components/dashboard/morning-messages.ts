/**
 * Mensagens matinais personalizadas por tipo de Human Design
 * 
 * Filosofia Jobs: comunicação emocional, curta, humana
 * Human Design: cada tipo "acorda" de forma diferente
 * 
 * O dashboard é o primeiro contato do dia — como um "acordar digital"
 * Cada tipo processa a transição sono→vigília de forma única
 */

type TypeKey = "manifestor" | "generator" | "manifesting generator" | "projector" | "reflector";
type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

interface MorningMessage {
  greeting: string;
  question: string;
  guidance: string;
  action: {
    label: string;
    href: string;
    emphasis?: boolean;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
}

// Saudações por período do dia
const TIME_GREETINGS: Record<TimeOfDay, string> = {
  morning: "Bom dia",
  afternoon: "Boa tarde",
  evening: "Boa noite",
  night: "Boa noite",
};

/**
 * Mensagens específicas por tipo — baseadas na Estratégia
 * 
 * Generator/MG: Responder à vida → "O que chegou para você?"
 * Projector: Esperar convite → "Quem reconheceu você?"
 * Manifestor: Informar → "O que você quer iniciar?"
 * Reflector: Ciclo lunar → "Como está o ambiente?"
 */
const TYPE_MESSAGES: Record<TypeKey, Record<TimeOfDay, MorningMessage>> = {
  generator: {
    morning: {
      greeting: "Seu sacral está acordando",
      question: "O que acende sua energia hoje?",
      guidance: "Observe o que chega até você. Sua resposta corporal sabe antes da mente.",
      action: { label: "Registrar minha energia", href: "/diario", emphasis: true },
      secondaryAction: { label: "Conversar com Kairos", href: "/ia" },
    },
    afternoon: {
      greeting: "Energia em movimento",
      question: "O que está pedindo sua resposta?",
      guidance: "Generators têm energia sustentada quando fazem o que amam. O que te satisfaz agora?",
      action: { label: "Fazer check-in", href: "/diario" },
      secondaryAction: { label: "Abrir mentora", href: "/ia" },
    },
    evening: {
      greeting: "Hora de desacelerar",
      question: "O que trouxe satisfação hoje?",
      guidance: "Antes de dormir, seu sacral precisa descarregar. O que valeu a pena?",
      action: { label: "Refletir sobre o dia", href: "/diario" },
      secondaryAction: { label: "Conversar com Kairos", href: "/ia" },
    },
    night: {
      greeting: "Descanso merecido",
      question: "Seu corpo pede descanso?",
      guidance: "Generators precisam esgotar a energia do sacral para dormir bem.",
      action: { label: "Registrar o dia", href: "/diario" },
    },
  },

  "manifesting generator": {
    morning: {
      greeting: "Múltiplas possibilidades te esperam",
      question: "O que faz seu sacral pular?",
      guidance: "Você pode responder E iniciar. Confie nos pivots — eles são seu superpoder.",
      action: { label: "Registrar minha energia", href: "/diario", emphasis: true },
      secondaryAction: { label: "Conversar com Kairos", href: "/ia" },
    },
    afternoon: {
      greeting: "Energia multitarefa ativa",
      question: "Está seguindo o que te acende?",
      guidance: "MGs podem parecer pulando de galho em galho, mas você está encontrando seu caminho único.",
      action: { label: "Fazer check-in", href: "/diario" },
      secondaryAction: { label: "Abrir mentora", href: "/ia" },
    },
    evening: {
      greeting: "Velocidade desacelerando",
      question: "O que funcionou hoje? O que você pivotou?",
      guidance: "Seus atalhos e mudanças de direção são eficiência, não inconsistência.",
      action: { label: "Refletir sobre o dia", href: "/diario" },
      secondaryAction: { label: "Conversar com Kairos", href: "/ia" },
    },
    night: {
      greeting: "Motor desligando",
      question: "Energia gasta no que vale?",
      guidance: "Seu corpo precisa se esgotar antes de descansar. Você se moveu o suficiente?",
      action: { label: "Registrar o dia", href: "/diario" },
    },
  },

  projector: {
    morning: {
      greeting: "Seus olhos enxergam diferente",
      question: "Quem está pedindo sua orientação?",
      guidance: "Espere o convite certo. Sua energia é preciosa — guarde-a para quem te reconhece.",
      action: { label: "Como está minha energia?", href: "/diario", emphasis: true },
      secondaryAction: { label: "Falar com Kairos", href: "/ia" },
    },
    afternoon: {
      greeting: "Sabedoria em ação",
      question: "Você foi reconhecido hoje?",
      guidance: "Projectors guiam melhor quando convidados. Quem te procurou?",
      action: { label: "Registrar reconhecimentos", href: "/diario" },
      secondaryAction: { label: "Consultar mentora", href: "/ia" },
    },
    evening: {
      greeting: "Hora de se recolher",
      question: "Você descansou o suficiente?",
      guidance: "Projectors precisam de mais descanso que outros tipos. Honre isso.",
      action: { label: "Reflexão do dia", href: "/diario" },
      secondaryAction: { label: "Conversar com Kairos", href: "/ia" },
    },
    night: {
      greeting: "Deitar antes do cansaço extremo",
      question: "Seu corpo pede recolhimento?",
      guidance: "Vá para a cama antes de estar exausto. Seu sistema precisa de recuperação.",
      action: { label: "Registrar o dia", href: "/diario" },
    },
  },

  manifestor: {
    morning: {
      greeting: "O mundo espera sua iniciação",
      question: "O que você quer colocar em movimento hoje?",
      guidance: "Informe antes de agir. Isso remove resistência e libera seu fluxo.",
      action: { label: "Definir minha intenção", href: "/diario", emphasis: true },
      secondaryAction: { label: "Planejar com Kairos", href: "/ia" },
    },
    afternoon: {
      greeting: "Impacto em andamento",
      question: "Você informou quem precisa saber?",
      guidance: "Manifestors encontram paz quando informam. A raiva vem da resistência alheia.",
      action: { label: "Check-in do dia", href: "/diario" },
      secondaryAction: { label: "Falar com mentora", href: "/ia" },
    },
    evening: {
      greeting: "Ciclo completando",
      question: "O que você iniciou hoje?",
      guidance: "Você não precisa terminar tudo. Iniciar é seu dom — outros podem continuar.",
      action: { label: "Registrar iniciativas", href: "/diario" },
      secondaryAction: { label: "Conversar com Kairos", href: "/ia" },
    },
    night: {
      greeting: "Descanso do iniciador",
      question: "Você encontrou paz hoje?",
      guidance: "Manifestors precisam de solidão para recarregar. Como está sua aura?",
      action: { label: "Reflexão noturna", href: "/diario" },
    },
  },

  reflector: {
    morning: {
      greeting: "Novo ciclo, nova perspectiva",
      question: "Como está a energia ao seu redor?",
      guidance: "Você reflete o ambiente. Antes de decidir qualquer coisa, sinta o que está captando.",
      action: { label: "Sentir o dia", href: "/diario", emphasis: true },
      secondaryAction: { label: "Explorar com Kairos", href: "/ia" },
    },
    afternoon: {
      greeting: "Espelhando o coletivo",
      question: "O que você está captando dos outros?",
      guidance: "Sua sensibilidade é um dom. Use-a para avaliar a qualidade do seu ambiente.",
      action: { label: "Registrar percepções", href: "/diario" },
      secondaryAction: { label: "Conversar com mentora", href: "/ia" },
    },
    evening: {
      greeting: "Processando o dia",
      question: "O que foi dos outros? O que foi seu?",
      guidance: "Reflectors absorvem muito. Separe o que é energia alheia do que é genuinamente seu.",
      action: { label: "Diferenciar energias", href: "/diario" },
      secondaryAction: { label: "Falar com Kairos", href: "/ia" },
    },
    night: {
      greeting: "Liberando o que não é seu",
      question: "Você consegue se separar do que absorveu?",
      guidance: "Durma sozinho quando possível. Sua aura precisa limpar o condicionamento do dia.",
      action: { label: "Reflexão noturna", href: "/diario" },
    },
  },
};

// Mensagem padrão para tipos não identificados
const DEFAULT_MESSAGE: MorningMessage = {
  greeting: "Bem-vindo ao seu dia",
  question: "Como você está se sentindo?",
  guidance: "Complete seu perfil de Human Design para receber orientações personalizadas.",
  action: { label: "Completar meu design", href: "/meu-design", emphasis: true },
  secondaryAction: { label: "Conversar com Kairos", href: "/ia" },
};

/**
 * Determina o período do dia baseado na hora atual
 */
export function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "night";
}

/**
 * Normaliza o tipo para a chave do mapa
 */
function normalizeType(rawType?: string | null): TypeKey | null {
  if (!rawType) return null;
  const v = rawType.toLowerCase().trim();
  if (v === "mg" || v === "manifesting generator") return "manifesting generator";
  if (v === "generator") return "generator";
  if (v === "manifestor") return "manifestor";
  if (v === "projector") return "projector";
  if (v === "reflector") return "reflector";
  return null;
}

/**
 * Retorna a mensagem matinal personalizada
 */
export function getMorningMessage(rawType?: string | null): MorningMessage & { timeGreeting: string } {
  const timeOfDay = getTimeOfDay();
  const timeGreeting = TIME_GREETINGS[timeOfDay];
  const typeKey = normalizeType(rawType);

  if (!typeKey) {
    return { ...DEFAULT_MESSAGE, timeGreeting };
  }

  const typeMessages = TYPE_MESSAGES[typeKey];
  const message = typeMessages[timeOfDay];

  return { ...message, timeGreeting };
}

/**
 * Retorna saudação simples com nome
 */
export function getPersonalGreeting(name?: string | null): string {
  const timeOfDay = getTimeOfDay();
  const greeting = TIME_GREETINGS[timeOfDay];
  return name ? `${greeting}, ${name}` : greeting;
}

