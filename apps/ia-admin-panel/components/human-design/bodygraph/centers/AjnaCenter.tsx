"use client";

import { CenterBase } from "./CenterBase";
import type { CenterState } from "../types";

interface AjnaCenterProps {
  state: CenterState;
  x?: number;
  y?: number;
  onClick?: (event?: React.MouseEvent) => void;
  onHover?: (isHovering: boolean) => void;
  isHighlighted?: boolean;
}

/**
 * Ajna Center - Triangle pointing up (vertex at bottom)
 * Awareness center for conceptualization and mental processing
 * Gates: 47, 24, 4, 17, 43, 11
 */
export function AjnaCenter({ state, onClick, onHover, isHighlighted }: AjnaCenterProps) {
  return (
    <CenterBase
      name="ajna"
      state={state}
      onClick={onClick}
      onHover={onHover}
      isHighlighted={isHighlighted}
      useOfficialPath={true}
    />
  );
}
