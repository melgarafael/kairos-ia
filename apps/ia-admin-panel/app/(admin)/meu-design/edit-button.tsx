"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditDesignModal } from "@/components/human-design/edit-design-modal";

interface EditButtonProps {
  currentBirthDate?: string;
  currentBirthTime?: string;
  currentLocation?: string;
  currentTimezone?: string;
}

export function EditButton({
  currentBirthDate,
  currentBirthTime,
  currentLocation,
  currentTimezone,
}: EditButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="sm"
        className="gap-2 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-white/70 hover:text-white/90"
      >
        <Pencil className="w-4 h-4" />
        <span className="hidden sm:inline">Editar</span>
      </Button>

      <EditDesignModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentBirthDate={currentBirthDate}
        currentBirthTime={currentBirthTime}
        currentLocation={currentLocation}
        currentTimezone={currentTimezone}
      />
    </>
  );
}

