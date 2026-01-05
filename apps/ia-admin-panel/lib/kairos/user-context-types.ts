/**
 * User Life Context - Types and Constants
 * 
 * This file contains ONLY types and constants that can be safely imported
 * by both Server and Client components.
 * 
 * For server-side functions, see user-context.ts
 */

// =============================================================================
// Types
// =============================================================================

export type RelacionamentoInfo = {
  nome: string;
  tipo: string; // parceiro, família, amigo, colega, etc.
  notas?: string;
};

export type EventoMarcante = {
  ano: number;
  descricao: string;
};

export type UserLifeContext = {
  user_id: string;
  
  // Profissional
  profissao_atual: string | null;
  empresa_situacao: string | null;
  desafios_profissionais: string[] | null;
  aspiracoes_carreira: string | null;
  narrativa_profissional: string | null;
  
  // Relacionamentos
  status_relacionamento: string | null;
  relacionamentos_importantes: RelacionamentoInfo[] | null;
  desafios_relacionamentos: string[] | null;
  narrativa_relacionamentos: string | null;
  
  // Pessoal
  valores_pessoais: string[] | null;
  hobbies_interesses: string[] | null;
  rotina_diaria: string | null;
  foco_saude: string | null;
  narrativa_pessoal: string | null;
  
  // História
  eventos_marcantes: EventoMarcante[] | null;
  transformacoes_vida: string | null;
  jornada_hd: string | null;
  narrativa_historia: string | null;
  
  // Metas HD
  areas_aplicar_hd: string[] | null;
  padroes_nao_self_notados: string[] | null;
  objetivos_com_hd: string | null;
  narrativa_metas: string | null;
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
};

export type UserLifeContextInput = Partial<Omit<UserLifeContext, "user_id" | "created_at" | "updated_at">>;

// =============================================================================
// Constants
// =============================================================================

export const EMPRESA_SITUACAO_OPTIONS = [
  { value: "empregado", label: "Empregado(a)" },
  { value: "autonomo", label: "Autônomo/Freelancer" },
  { value: "empresario", label: "Empresário(a)" },
  { value: "desempregado", label: "Desempregado(a)/Em transição" },
  { value: "estudante", label: "Estudante" },
  { value: "aposentado", label: "Aposentado(a)" },
] as const;

export const STATUS_RELACIONAMENTO_OPTIONS = [
  { value: "solteiro", label: "Solteiro(a)" },
  { value: "namorando", label: "Namorando" },
  { value: "casado", label: "Casado(a)/União estável" },
  { value: "divorciado", label: "Divorciado(a)/Separado(a)" },
  { value: "viuvo", label: "Viúvo(a)" },
] as const;

export const AREAS_APLICAR_HD_OPTIONS = [
  { value: "carreira", label: "Carreira e trabalho" },
  { value: "relacionamentos", label: "Relacionamentos" },
  { value: "saude", label: "Saúde e bem-estar" },
  { value: "proposito", label: "Propósito de vida" },
  { value: "decisoes", label: "Tomada de decisões" },
  { value: "autoconhecimento", label: "Autoconhecimento" },
  { value: "familia", label: "Família e parentalidade" },
  { value: "financas", label: "Finanças" },
  { value: "criatividade", label: "Criatividade e expressão" },
] as const;

export const DESAFIOS_PROFISSIONAIS_SUGGESTIONS = [
  "Dificuldade em tomar decisões",
  "Esgotamento/burnout",
  "Falta de reconhecimento",
  "Conflitos com colegas/chefe",
  "Transição de carreira",
  "Encontrar propósito no trabalho",
  "Equilíbrio vida-trabalho",
  "Síndrome do impostor",
  "Procrastinação",
  "Excesso de responsabilidades",
];

export const PADROES_NAO_SELF_SUGGESTIONS = [
  "Iniciar sem ser convidado(a)",
  "Não esperar para responder",
  "Decisões por pressão/emoção",
  "Dizer sim quando é não",
  "Buscar atenção/reconhecimento",
  "Fazer para provar valor",
  "Pressa nas decisões",
  "Evitar conflitos",
  "Tentar ser quem não sou",
  "Ignorar sinais do corpo",
];

