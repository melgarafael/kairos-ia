"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  Heart,
  User,
  History,
  Target,
  Loader2,
  Check,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { TagInput, RelationshipInput } from "@/components/context";
import {
  type UserLifeContext,
  type RelacionamentoInfo,
  EMPRESA_SITUACAO_OPTIONS,
  STATUS_RELACIONAMENTO_OPTIONS,
  AREAS_APLICAR_HD_OPTIONS,
  DESAFIOS_PROFISSIONAIS_SUGGESTIONS,
  PADROES_NAO_SELF_SUGGESTIONS,
} from "@/lib/kairos/user-context-types";

// =============================================================================
// Types
// =============================================================================

type TabId = "profissional" | "relacionamentos" | "pessoal" | "historia" | "metas";

type TabConfig = {
  id: TabId;
  label: string;
  icon: React.ElementType;
  description: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

// =============================================================================
// Constants
// =============================================================================

const TABS: TabConfig[] = [
  {
    id: "profissional",
    label: "Profissional",
    icon: Briefcase,
    description: "Carreira, desafios e aspirações",
  },
  {
    id: "relacionamentos",
    label: "Relacionamentos",
    icon: Heart,
    description: "Pessoas importantes na sua vida",
  },
  {
    id: "pessoal",
    label: "Pessoal",
    icon: User,
    description: "Valores, interesses e rotina",
  },
  {
    id: "historia",
    label: "História",
    icon: History,
    description: "Eventos marcantes e transformações",
  },
  {
    id: "metas",
    label: "Metas HD",
    icon: Target,
    description: "Objetivos com Human Design",
  },
];

const AUTO_SAVE_DELAY = 1500;

// =============================================================================
// Main Component
// =============================================================================

export default function MeuContextoPage() {
  const [activeTab, setActiveTab] = useState<TabId>("profissional");
  const [context, setContext] = useState<Partial<UserLifeContext>>({});
  const [completion, setCompletion] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [, startTransition] = useTransition();

  // Fetch initial data
  useEffect(() => {
    async function fetchContext() {
      try {
        const res = await fetch("/api/user-context");
        if (res.ok) {
          const data = await res.json();
          setContext(data.context || {});
          setCompletion(data.completion || {});
        }
      } catch (error) {
        console.error("Error fetching context:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchContext();
  }, []);

  // Auto-save with debounce
  const saveContext = useCallback(
    async (updates: Partial<UserLifeContext>) => {
      setSaveStatus("saving");
      try {
        const res = await fetch("/api/user-context", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (res.ok) {
          const data = await res.json();
          setCompletion(data.completion || {});
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } else {
          setSaveStatus("error");
          setTimeout(() => setSaveStatus("idle"), 3000);
        }
      } catch {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    },
    []
  );

  // Debounced update handler
  const handleUpdate = useCallback(
    (field: keyof UserLifeContext, value: unknown) => {
      setContext((prev) => ({ ...prev, [field]: value }));

      startTransition(() => {
        const timeout = setTimeout(() => {
          saveContext({ [field]: value });
        }, AUTO_SAVE_DELAY);

        return () => clearTimeout(timeout);
      });
    },
    [saveContext]
  );

  // Current tab config
  const currentTab = TABS.find((t) => t.id === activeTab)!;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">
          Contexto
        </p>
        <h1 className="text-2xl font-semibold text-white/90">
          Sobre Você
        </h1>
        <p className="text-sm text-white/50 max-w-lg">
          Informações que ajudam a Kairos a compreender sua mecânica única e
          oferecer orientações alinhadas ao seu Design.
        </p>
      </header>

      {/* Progress Overview */}
      <div className="grid grid-cols-5 gap-2">
        {TABS.map((tab) => {
          const progress = completion[tab.id] || 0;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative p-3 rounded-xl border transition-all duration-200",
                activeTab === tab.id
                  ? "bg-white/[0.06] border-white/15"
                  : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10"
              )}
            >
              <div className="flex flex-col items-center gap-2">
                <Icon
                  className={cn(
                    "w-5 h-5",
                    activeTab === tab.id ? "text-white/80" : "text-white/40"
                  )}
                />
                <span
                  className={cn(
                    "text-xs font-medium",
                    activeTab === tab.id ? "text-white/80" : "text-white/50"
                  )}
                >
                  {tab.label}
                </span>
                {/* Progress bar */}
                <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={cn(
                      "h-full rounded-full",
                      progress >= 75
                        ? "bg-emerald-500/60"
                        : progress >= 50
                        ? "bg-amber-500/60"
                        : "bg-white/30"
                    )}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div
        className={cn(
          "relative rounded-2xl border border-white/5 bg-white/[0.02]",
          "overflow-hidden"
        )}
      >
        {/* Tab Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <currentTab.icon className="w-5 h-5 text-white/50" />
            <div>
              <h2 className="text-lg font-medium text-white/90">
                {currentTab.label}
              </h2>
              <p className="text-xs text-white/40">{currentTab.description}</p>
            </div>
          </div>

          {/* Save status indicator */}
          <AnimatePresence mode="wait">
            {saveStatus !== "idle" && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-2"
              >
                {saveStatus === "saving" && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                    <span className="text-xs text-white/40">Salvando...</span>
                  </>
                )}
                {saveStatus === "saved" && (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-emerald-400/70">Salvo</span>
                  </>
                )}
                {saveStatus === "error" && (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-red-400/70">Erro ao salvar</span>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "profissional" && (
                <ProfissionalTab context={context} onUpdate={handleUpdate} />
              )}
              {activeTab === "relacionamentos" && (
                <RelacionamentosTab context={context} onUpdate={handleUpdate} />
              )}
              {activeTab === "pessoal" && (
                <PessoalTab context={context} onUpdate={handleUpdate} />
              )}
              {activeTab === "historia" && (
                <HistoriaTab context={context} onUpdate={handleUpdate} />
              )}
              {activeTab === "metas" && (
                <MetasTab context={context} onUpdate={handleUpdate} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Info footer */}
      <footer className="pt-4 border-t border-white/5">
        <div className="flex items-start gap-3 text-xs text-white/30">
          <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            Essas informações são usadas exclusivamente pela Kairos IA para
            personalizar suas orientações de Human Design. Quanto mais contexto
            você fornecer, mais relevantes serão os insights.
          </p>
        </div>
      </footer>
    </div>
  );
}

// =============================================================================
// Tab Components
// =============================================================================

interface TabProps {
  context: Partial<UserLifeContext>;
  onUpdate: (field: keyof UserLifeContext, value: unknown) => void;
}

function ProfissionalTab({ context, onUpdate }: TabProps) {
  return (
    <div className="space-y-6">
      {/* Profissão */}
      <FieldGroup label="Profissão atual" hint="O que você faz?">
        <input
          type="text"
          value={context.profissao_atual || ""}
          onChange={(e) => onUpdate("profissao_atual", e.target.value)}
          placeholder="Ex: Designer, Desenvolvedor, Terapeuta..."
          className={cn(
            "w-full px-4 py-3 rounded-xl",
            "bg-white/[0.04] border border-white/5",
            "text-white/90 placeholder:text-white/25",
            "focus:outline-none focus:border-white/15 focus:bg-white/[0.06]",
            "transition-all duration-200"
          )}
        />
      </FieldGroup>

      {/* Situação */}
      <FieldGroup label="Situação" hint="Seu contexto de trabalho">
        <select
          value={context.empresa_situacao || ""}
          onChange={(e) => onUpdate("empresa_situacao", e.target.value)}
          className={cn(
            "w-full px-4 py-3 rounded-xl",
            "bg-white/[0.04] border border-white/5",
            "text-white/90",
            "focus:outline-none focus:border-white/15",
            "transition-all duration-200"
          )}
        >
          <option value="">Selecione...</option>
          {EMPRESA_SITUACAO_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FieldGroup>

      {/* Desafios */}
      <FieldGroup label="Desafios profissionais" hint="O que está difícil?">
        <TagInput
          value={context.desafios_profissionais || []}
          onChange={(tags) => onUpdate("desafios_profissionais", tags)}
          placeholder="Adicionar desafio..."
          suggestions={DESAFIOS_PROFISSIONAIS_SUGGESTIONS}
        />
      </FieldGroup>

      {/* Aspirações */}
      <FieldGroup label="Aspirações" hint="Para onde você quer ir?">
        <textarea
          value={context.aspiracoes_carreira || ""}
          onChange={(e) => onUpdate("aspiracoes_carreira", e.target.value)}
          placeholder="Seus objetivos e sonhos de carreira..."
          rows={3}
          className={cn(
            "w-full px-4 py-3 rounded-xl resize-none",
            "bg-white/[0.04] border border-white/5",
            "text-white/90 placeholder:text-white/25",
            "focus:outline-none focus:border-white/15 focus:bg-white/[0.06]",
            "transition-all duration-200"
          )}
        />
      </FieldGroup>

      {/* Narrativa livre */}
      <FieldGroup label="Contexto adicional" hint="Algo mais que a Kairos deva saber?">
        <textarea
          value={context.narrativa_profissional || ""}
          onChange={(e) => onUpdate("narrativa_profissional", e.target.value)}
          placeholder="Conte mais sobre sua trajetória, ambiente de trabalho, dinâmicas..."
          rows={4}
          className={cn(
            "w-full px-4 py-3 rounded-xl resize-none",
            "bg-white/[0.04] border border-white/5",
            "text-white/90 placeholder:text-white/25",
            "focus:outline-none focus:border-white/15 focus:bg-white/[0.06]",
            "transition-all duration-200"
          )}
        />
      </FieldGroup>
    </div>
  );
}

function RelacionamentosTab({ context, onUpdate }: TabProps) {
  return (
    <div className="space-y-6">
      {/* Status */}
      <FieldGroup label="Status de relacionamento">
        <select
          value={context.status_relacionamento || ""}
          onChange={(e) => onUpdate("status_relacionamento", e.target.value)}
          className={cn(
            "w-full px-4 py-3 rounded-xl",
            "bg-white/[0.04] border border-white/5",
            "text-white/90",
            "focus:outline-none focus:border-white/15",
            "transition-all duration-200"
          )}
        >
          <option value="">Selecione...</option>
          {STATUS_RELACIONAMENTO_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FieldGroup>

      {/* Pessoas importantes */}
      <FieldGroup
        label="Pessoas importantes"
        hint="Quem faz parte da sua vida? (parceiro, família, amigos...)"
      >
        <RelationshipInput
          value={(context.relacionamentos_importantes as RelacionamentoInfo[]) || []}
          onChange={(rels) => onUpdate("relacionamentos_importantes", rels)}
        />
      </FieldGroup>

      {/* Desafios */}
      <FieldGroup label="Desafios nos relacionamentos">
        <TagInput
          value={context.desafios_relacionamentos || []}
          onChange={(tags) => onUpdate("desafios_relacionamentos", tags)}
          placeholder="Adicionar desafio..."
          suggestions={[
            "Comunicação",
            "Limites saudáveis",
            "Confiança",
            "Expectativas",
            "Tempo de qualidade",
            "Conflitos recorrentes",
            "Distância emocional",
          ]}
        />
      </FieldGroup>

      {/* Narrativa */}
      <FieldGroup label="Contexto adicional">
        <textarea
          value={context.narrativa_relacionamentos || ""}
          onChange={(e) => onUpdate("narrativa_relacionamentos", e.target.value)}
          placeholder="Dinâmicas importantes, padrões que percebe, o que busca nos relacionamentos..."
          rows={4}
          className={cn(
            "w-full px-4 py-3 rounded-xl resize-none",
            "bg-white/[0.04] border border-white/5",
            "text-white/90 placeholder:text-white/25",
            "focus:outline-none focus:border-white/15 focus:bg-white/[0.06]",
            "transition-all duration-200"
          )}
        />
      </FieldGroup>
    </div>
  );
}

function PessoalTab({ context, onUpdate }: TabProps) {
  return (
    <div className="space-y-6">
      {/* Valores */}
      <FieldGroup label="Valores pessoais" hint="O que é mais importante para você?">
        <TagInput
          value={context.valores_pessoais || []}
          onChange={(tags) => onUpdate("valores_pessoais", tags)}
          placeholder="Adicionar valor..."
          suggestions={[
            "Liberdade",
            "Autenticidade",
            "Família",
            "Crescimento",
            "Criatividade",
            "Honestidade",
            "Conexão",
            "Paz",
            "Propósito",
            "Segurança",
          ]}
        />
      </FieldGroup>

      {/* Hobbies */}
      <FieldGroup label="Hobbies e interesses" hint="O que você gosta de fazer?">
        <TagInput
          value={context.hobbies_interesses || []}
          onChange={(tags) => onUpdate("hobbies_interesses", tags)}
          placeholder="Adicionar interesse..."
          suggestions={[
            "Leitura",
            "Meditação",
            "Exercícios",
            "Música",
            "Natureza",
            "Viagens",
            "Arte",
            "Culinária",
            "Games",
            "Escrita",
          ]}
        />
      </FieldGroup>

      {/* Rotina */}
      <FieldGroup label="Rotina diária" hint="Como é seu dia a dia?">
        <textarea
          value={context.rotina_diaria || ""}
          onChange={(e) => onUpdate("rotina_diaria", e.target.value)}
          placeholder="Descreva sua rotina: horários, hábitos, ritmo..."
          rows={3}
          className={cn(
            "w-full px-4 py-3 rounded-xl resize-none",
            "bg-white/[0.04] border border-white/5",
            "text-white/90 placeholder:text-white/25",
            "focus:outline-none focus:border-white/15 focus:bg-white/[0.06]",
            "transition-all duration-200"
          )}
        />
      </FieldGroup>

      {/* Saúde */}
      <FieldGroup label="Foco de saúde" hint="Áreas que está cuidando">
        <textarea
          value={context.foco_saude || ""}
          onChange={(e) => onUpdate("foco_saude", e.target.value)}
          placeholder="Saúde física, mental, emocional, hábitos que está desenvolvendo..."
          rows={2}
          className={cn(
            "w-full px-4 py-3 rounded-xl resize-none",
            "bg-white/[0.04] border border-white/5",
            "text-white/90 placeholder:text-white/25",
            "focus:outline-none focus:border-white/15 focus:bg-white/[0.06]",
            "transition-all duration-200"
          )}
        />
      </FieldGroup>

      {/* Narrativa */}
      <FieldGroup label="Contexto adicional">
        <textarea
          value={context.narrativa_pessoal || ""}
          onChange={(e) => onUpdate("narrativa_pessoal", e.target.value)}
          placeholder="Quem você é além do trabalho e relacionamentos..."
          rows={4}
          className={cn(
            "w-full px-4 py-3 rounded-xl resize-none",
            "bg-white/[0.04] border border-white/5",
            "text-white/90 placeholder:text-white/25",
            "focus:outline-none focus:border-white/15 focus:bg-white/[0.06]",
            "transition-all duration-200"
          )}
        />
      </FieldGroup>
    </div>
  );
}

function HistoriaTab({ context, onUpdate }: TabProps) {
  return (
    <div className="space-y-6">
      {/* Jornada HD */}
      <FieldGroup
        label="Jornada com Human Design"
        hint="Há quanto tempo conhece? Como descobriu?"
      >
        <textarea
          value={context.jornada_hd || ""}
          onChange={(e) => onUpdate("jornada_hd", e.target.value)}
          placeholder="Quando conheceu HD, o que já estudou, experiências com o experimento..."
          rows={3}
          className={cn(
            "w-full px-4 py-3 rounded-xl resize-none",
            "bg-white/[0.04] border border-white/5",
            "text-white/90 placeholder:text-white/25",
            "focus:outline-none focus:border-white/15 focus:bg-white/[0.06]",
            "transition-all duration-200"
          )}
        />
      </FieldGroup>

      {/* Transformações */}
      <FieldGroup
        label="Transformações de vida"
        hint="Mudanças importantes que moldaram quem você é"
      >
        <textarea
          value={context.transformacoes_vida || ""}
          onChange={(e) => onUpdate("transformacoes_vida", e.target.value)}
          placeholder="Momentos de virada, decisões importantes, crises que te transformaram..."
          rows={4}
          className={cn(
            "w-full px-4 py-3 rounded-xl resize-none",
            "bg-white/[0.04] border border-white/5",
            "text-white/90 placeholder:text-white/25",
            "focus:outline-none focus:border-white/15 focus:bg-white/[0.06]",
            "transition-all duration-200"
          )}
        />
      </FieldGroup>

      {/* Narrativa */}
      <FieldGroup label="Sua história" hint="Conte sua trajetória de vida">
        <textarea
          value={context.narrativa_historia || ""}
          onChange={(e) => onUpdate("narrativa_historia", e.target.value)}
          placeholder="De onde você veio, o que viveu, o que te trouxe até aqui..."
          rows={6}
          className={cn(
            "w-full px-4 py-3 rounded-xl resize-none",
            "bg-white/[0.04] border border-white/5",
            "text-white/90 placeholder:text-white/25",
            "focus:outline-none focus:border-white/15 focus:bg-white/[0.06]",
            "transition-all duration-200"
          )}
        />
      </FieldGroup>
    </div>
  );
}

function MetasTab({ context, onUpdate }: TabProps) {
  return (
    <div className="space-y-6">
      {/* Áreas para aplicar HD */}
      <FieldGroup
        label="Áreas para aplicar Human Design"
        hint="Onde você quer usar HD na prática?"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {AREAS_APLICAR_HD_OPTIONS.map((opt) => {
            const isSelected = context.areas_aplicar_hd?.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const current = context.areas_aplicar_hd || [];
                  const updated = isSelected
                    ? current.filter((v) => v !== opt.value)
                    : [...current, opt.value];
                  onUpdate("areas_aplicar_hd", updated);
                }}
                className={cn(
                  "px-3 py-2.5 rounded-lg text-sm text-left transition-all duration-200",
                  isSelected
                    ? "bg-white/10 border-white/20 text-white/90"
                    : "bg-white/[0.03] border-white/5 text-white/50 hover:bg-white/[0.06] hover:text-white/70",
                  "border"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </FieldGroup>

      {/* Padrões Não-Self */}
      <FieldGroup
        label="Padrões Não-Self que você notou"
        hint="Comportamentos condicionados que quer observar"
      >
        <TagInput
          value={context.padroes_nao_self_notados || []}
          onChange={(tags) => onUpdate("padroes_nao_self_notados", tags)}
          placeholder="Adicionar padrão..."
          suggestions={PADROES_NAO_SELF_SUGGESTIONS}
        />
      </FieldGroup>

      {/* Objetivos */}
      <FieldGroup
        label="Objetivos com Human Design"
        hint="O que você espera alcançar?"
      >
        <textarea
          value={context.objetivos_com_hd || ""}
          onChange={(e) => onUpdate("objetivos_com_hd", e.target.value)}
          placeholder="O que você quer transformar vivendo seu design? Que resultados espera?"
          rows={3}
          className={cn(
            "w-full px-4 py-3 rounded-xl resize-none",
            "bg-white/[0.04] border border-white/5",
            "text-white/90 placeholder:text-white/25",
            "focus:outline-none focus:border-white/15 focus:bg-white/[0.06]",
            "transition-all duration-200"
          )}
        />
      </FieldGroup>

      {/* Narrativa */}
      <FieldGroup label="Contexto adicional">
        <textarea
          value={context.narrativa_metas || ""}
          onChange={(e) => onUpdate("narrativa_metas", e.target.value)}
          placeholder="Outras expectativas, dúvidas, áreas que quer explorar..."
          rows={4}
          className={cn(
            "w-full px-4 py-3 rounded-xl resize-none",
            "bg-white/[0.04] border border-white/5",
            "text-white/90 placeholder:text-white/25",
            "focus:outline-none focus:border-white/15 focus:bg-white/[0.06]",
            "transition-all duration-200"
          )}
        />
      </FieldGroup>
    </div>
  );
}

// =============================================================================
// Helper Components
// =============================================================================

function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <label className="block text-sm font-medium text-white/80">{label}</label>
        {hint && <p className="text-xs text-white/40">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

