"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditDesignModal } from "./edit-design-modal";

interface DesignHeaderWithEditProps {
  birthDateDisplay?: string; // Human readable: "5th May 2019 @ 10:10"
  birthDateISO?: string; // YYYY-MM-DD
  birthTimeISO?: string; // HH:mm
  birthLocation?: string;
  timezone?: string;
}

export function DesignHeaderWithEdit({
  birthDateDisplay,
  birthDateISO,
  birthTimeISO,
  birthLocation,
  timezone,
}: DesignHeaderWithEditProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  return (
    <>
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
              Identidade
            </p>
            <h1 className="text-3xl font-semibold">Meu Design Humano</h1>
            <p className="text-muted-foreground max-w-xl">
              Este é o seu mapa energético completo. A mentora Kairos usa esses dados para
              personalizar orientações e conversas.
            </p>
          </div>

          {/* Edit Button */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Button
              onClick={() => setIsEditModalOpen(true)}
              variant="outline"
              size="sm"
              className="gap-2 bg-white/5 border-white/10 hover:bg-white/10 hover:border-violet-500/30"
            >
              <Pencil className="w-4 h-4" />
              <span className="hidden sm:inline">Editar dados</span>
            </Button>
          </motion.div>
        </div>

        {/* Birth info badge */}
        {birthDateDisplay && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20"
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-sm text-violet-300">{birthDateDisplay}</span>
          </motion.div>
        )}
      </header>

      {/* Edit Modal */}
      <EditDesignModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        currentBirthDate={birthDateISO}
        currentBirthTime={birthTimeISO}
        currentLocation={birthLocation}
        currentTimezone={timezone}
      />
    </>
  );
}
