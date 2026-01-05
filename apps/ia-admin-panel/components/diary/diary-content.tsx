"use client";

import { useState } from "react";
import { ReflectionForm } from "./reflection-form";
import { DiaryTimeline } from "./diary-timeline";
import { EditEntryModal } from "./edit-entry-modal";
import type { DiaryEntry } from "./diary-entry-card";

interface DiaryContentProps {
  entries: DiaryEntry[];
  onSubmit: (formData: FormData) => Promise<void>;
  onUpdate: (formData: FormData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function DiaryContent({ entries, onSubmit, onUpdate, onDelete }: DiaryContentProps) {
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-5">
        {/* Form - takes more space */}
        <div className="lg:col-span-2">
          <ReflectionForm onSubmit={onSubmit} />
        </div>

        {/* Timeline */}
        <div className="lg:col-span-3">
          <DiaryTimeline 
            entries={entries} 
            onEdit={setEditingEntry}
          />
        </div>
      </div>

      {/* Edit Modal */}
      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          isOpen={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          onSave={onUpdate}
          onDelete={onDelete}
        />
      )}
    </>
  );
}
