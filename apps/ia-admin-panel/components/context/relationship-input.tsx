"use client";

import { useState } from "react";
import { X, Plus, User } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { motion, AnimatePresence } from "framer-motion";
import type { RelacionamentoInfo } from "@/lib/kairos/user-context-types";

interface RelationshipInputProps {
  value: RelacionamentoInfo[];
  onChange: (relationships: RelacionamentoInfo[]) => void;
  maxItems?: number;
}

const TIPO_OPTIONS = [
  { value: "parceiro", label: "Parceiro(a)" },
  { value: "familia", label: "Família" },
  { value: "amigo", label: "Amigo(a)" },
  { value: "colega", label: "Colega" },
  { value: "chefe", label: "Chefe/Gestor" },
  { value: "filho", label: "Filho(a)" },
  { value: "pai_mae", label: "Pai/Mãe" },
  { value: "irmao", label: "Irmão/Irmã" },
  { value: "outro", label: "Outro" },
];

export function RelationshipInput({
  value = [],
  onChange,
  maxItems = 10,
}: RelationshipInputProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newRelation, setNewRelation] = useState<RelacionamentoInfo>({
    nome: "",
    tipo: "familia",
    notas: "",
  });

  const addRelationship = () => {
    if (newRelation.nome.trim() && value.length < maxItems) {
      onChange([...value, { ...newRelation, nome: newRelation.nome.trim() }]);
      setNewRelation({ nome: "", tipo: "familia", notas: "" });
      setIsAdding(false);
    }
  };

  const removeRelationship = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateRelationship = (index: number, updates: Partial<RelacionamentoInfo>) => {
    onChange(
      value.map((rel, i) => (i === index ? { ...rel, ...updates } : rel))
    );
  };

  return (
    <div className="space-y-3">
      {/* Existing relationships */}
      <AnimatePresence mode="popLayout">
        {value.map((rel, index) => (
          <motion.div
            key={`${rel.nome}-${index}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "p-4 rounded-xl",
              "bg-white/[0.03] border border-white/5",
              "hover:bg-white/[0.04] transition-colors"
            )}
          >
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/[0.05] flex-shrink-0">
                <User className="w-5 h-5 text-white/40" />
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={rel.nome}
                    onChange={(e) =>
                      updateRelationship(index, { nome: e.target.value })
                    }
                    placeholder="Nome"
                    className={cn(
                      "flex-1 bg-transparent px-0 py-1",
                      "text-sm font-medium text-white/90 placeholder:text-white/30",
                      "focus:outline-none border-b border-transparent focus:border-white/10"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => removeRelationship(index)}
                    className="p-1 rounded hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4 text-white/40 hover:text-white/70" />
                  </button>
                </div>

                <select
                  value={rel.tipo}
                  onChange={(e) =>
                    updateRelationship(index, { tipo: e.target.value })
                  }
                  className={cn(
                    "w-full bg-white/[0.04] px-3 py-1.5 rounded-lg",
                    "text-xs text-white/70 border border-white/5",
                    "focus:outline-none focus:border-white/10"
                  )}
                >
                  {TIPO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={rel.notas || ""}
                  onChange={(e) =>
                    updateRelationship(index, { notas: e.target.value })
                  }
                  placeholder="Notas (ex: dinâmica, desafios...)"
                  className={cn(
                    "w-full bg-transparent px-0 py-1",
                    "text-xs text-white/60 placeholder:text-white/25",
                    "focus:outline-none"
                  )}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Add new relationship */}
      {value.length < maxItems && (
        <AnimatePresence mode="wait">
          {isAdding ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={cn(
                "p-4 rounded-xl",
                "bg-white/[0.04] border border-white/10"
              )}
            >
              <div className="space-y-3">
                <input
                  type="text"
                  value={newRelation.nome}
                  onChange={(e) =>
                    setNewRelation({ ...newRelation, nome: e.target.value })
                  }
                  placeholder="Nome da pessoa"
                  autoFocus
                  className={cn(
                    "w-full bg-white/[0.05] px-3 py-2 rounded-lg",
                    "text-sm text-white/90 placeholder:text-white/30",
                    "border border-white/5 focus:border-white/10",
                    "focus:outline-none"
                  )}
                />

                <select
                  value={newRelation.tipo}
                  onChange={(e) =>
                    setNewRelation({ ...newRelation, tipo: e.target.value })
                  }
                  className={cn(
                    "w-full bg-white/[0.05] px-3 py-2 rounded-lg",
                    "text-sm text-white/70 border border-white/5",
                    "focus:outline-none focus:border-white/10"
                  )}
                >
                  {TIPO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={newRelation.notas || ""}
                  onChange={(e) =>
                    setNewRelation({ ...newRelation, notas: e.target.value })
                  }
                  placeholder="Notas (opcional)"
                  className={cn(
                    "w-full bg-white/[0.05] px-3 py-2 rounded-lg",
                    "text-sm text-white/70 placeholder:text-white/30",
                    "border border-white/5 focus:border-white/10",
                    "focus:outline-none"
                  )}
                />

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm",
                      "text-white/50 hover:text-white/70",
                      "transition-colors"
                    )}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={addRelationship}
                    disabled={!newRelation.nome.trim()}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium",
                      "bg-white/10 text-white/90 border border-white/10",
                      "hover:bg-white/15 transition-colors",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="button"
              type="button"
              onClick={() => setIsAdding(true)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-3",
                "rounded-xl border border-dashed border-white/10",
                "text-sm text-white/40 hover:text-white/60",
                "hover:border-white/20 hover:bg-white/[0.02]",
                "transition-all duration-200"
              )}
            >
              <Plus className="w-4 h-4" />
              Adicionar pessoa importante
            </motion.button>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

