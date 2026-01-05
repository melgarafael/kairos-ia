"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, MapPin, Clock, Calendar, User, Tags } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { type HdFriend, RELATIONSHIP_TYPES } from "@/lib/kairos/types";
import { LocationSearch } from "@/components/onboarding/location-search";

interface AddFriendModalProps {
  open: boolean;
  onClose: () => void;
  onFriendAdded: (friend: HdFriend) => void;
}

export function AddFriendModal({ open, onClose, onFriendAdded }: AddFriendModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [relationshipType, setRelationshipType] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthLocation, setBirthLocation] = useState("");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setName("");
      setRelationshipType("");
      setNotes("");
      setBirthDate("");
      setBirthTime("");
      setBirthLocation("");
      setTimezone("America/Sao_Paulo");
      setSelectedLocation(null);
      setError(null);
    }
  }, [open]);

  const [selectedLocation, setSelectedLocation] = useState<{ id: string; name: string; fullName: string; region: string; country: string; timezone: string } | null>(null);
  
  const handleLocationChange = useCallback((location: { id: string; name: string; fullName: string; region: string; country: string; timezone: string } | null) => {
    setSelectedLocation(location);
    if (location) {
      setBirthLocation(location.fullName);
      setTimezone(location.timezone);
    } else {
      setBirthLocation("");
      setTimezone("America/Sao_Paulo");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError("Nome é obrigatório");
      return;
    }
    if (!birthDate) {
      setError("Data de nascimento é obrigatória");
      return;
    }
    if (!birthTime) {
      setError("Hora de nascimento é obrigatória");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          relationship_type: relationshipType || undefined,
          notes: notes.trim() || undefined,
          birth_date: birthDate,
          birth_time: birthTime,
          birth_location: birthLocation || undefined,
          timezone,
          calculateHD: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao adicionar pessoa");
      }

      onFriendAdded(data.friend);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar pessoa");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              "relative w-full max-w-lg max-h-[90vh] overflow-y-auto",
              "bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl"
            )}
          >
            {/* Header */}
            <div className="sticky top-0 flex items-center justify-between p-6 bg-zinc-900/95 backdrop-blur border-b border-white/5">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Adicionar Pessoa
                </h2>
                <p className="text-sm text-white/50">
                  O Human Design será calculado automaticamente
                </p>
              </div>
              <button
                onClick={onClose}
                className={cn(
                  "p-2 rounded-lg",
                  "hover:bg-white/10 transition-colors"
                )}
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                >
                  {error}
                </motion.div>
              )}

              {/* Name */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-white/70">
                  <User className="w-4 h-4" />
                  Nome *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome da pessoa"
                  className={cn(
                    "w-full px-4 py-3 rounded-xl text-sm",
                    "bg-white/5 border border-white/10 text-white placeholder:text-white/30",
                    "focus:outline-none focus:ring-2 focus:ring-white/20"
                  )}
                />
              </div>

              {/* Relationship Type */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-white/70">
                  <Tags className="w-4 h-4" />
                  Tipo de Relacionamento
                </label>
                <select
                  value={relationshipType}
                  onChange={(e) => setRelationshipType(e.target.value)}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl text-sm appearance-none",
                    "bg-white/5 border border-white/10 text-white",
                    "focus:outline-none focus:ring-2 focus:ring-white/20",
                    !relationshipType && "text-white/30"
                  )}
                >
                  <option value="">Selecione...</option>
                  {RELATIONSHIP_TYPES.map((type) => (
                    <option key={type.value} value={type.value} className="bg-zinc-800">
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Birth Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-white/70">
                    <Calendar className="w-4 h-4" />
                    Data de Nascimento *
                  </label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl text-sm",
                      "bg-white/5 border border-white/10 text-white",
                      "focus:outline-none focus:ring-2 focus:ring-white/20",
                      "[color-scheme:dark]"
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-white/70">
                    <Clock className="w-4 h-4" />
                    Hora de Nascimento *
                  </label>
                  <input
                    type="time"
                    value={birthTime}
                    onChange={(e) => setBirthTime(e.target.value)}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl text-sm",
                      "bg-white/5 border border-white/10 text-white",
                      "focus:outline-none focus:ring-2 focus:ring-white/20",
                      "[color-scheme:dark]"
                    )}
                  />
                </div>
              </div>

              {/* Birth Location */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-white/70">
                  <MapPin className="w-4 h-4" />
                  Local de Nascimento
                </label>
                <LocationSearch
                  value={selectedLocation}
                  onChange={handleLocationChange}
                  onTimezoneDetected={setTimezone}
                />
                <p className="text-xs text-white/30">
                  Fuso horário: {timezone}
                </p>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/70">
                  Notas (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações sobre esta pessoa..."
                  rows={3}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl text-sm resize-none",
                    "bg-white/5 border border-white/10 text-white placeholder:text-white/30",
                    "focus:outline-none focus:ring-2 focus:ring-white/20"
                  )}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium",
                    "text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                  )}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium",
                    "bg-emerald-600 text-white",
                    "hover:bg-emerald-500 transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Calculando HD...
                    </>
                  ) : (
                    "Adicionar"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

