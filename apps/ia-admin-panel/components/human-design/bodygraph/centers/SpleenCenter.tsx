"use client";

import { CenterBase } from "./CenterBase";
import type { CenterState } from "../types";

interface SpleenCenterProps {
  state: CenterState;
  x?: number;
  y?: number;
  onClick?: (event?: React.MouseEvent) => void;
  onHover?: (isHovering: boolean) => void;
  isHighlighted?: boolean;
}

/**
 * Spleen Center - Triangle pointing left
 * Intuition, health, and survival awareness
 * Gates: 48, 57, 44, 50, 32, 28, 18
 */
export function SpleenCenter({ state, onClick, onHover, isHighlighted }: SpleenCenterProps) {
  return (
    <CenterBase
      name="spleen"
      state={state}
      onClick={onClick}
      onHover={onHover}
      isHighlighted={isHighlighted}
      useOfficialPath={true}
    />
  );
}
