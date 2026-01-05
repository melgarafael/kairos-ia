"use client";

import { CenterBase } from "./CenterBase";
import type { CenterState } from "../types";

interface SacralCenterProps {
  state: CenterState;
  x?: number;
  y?: number;
  onClick?: (event?: React.MouseEvent) => void;
  onHover?: (isHovering: boolean) => void;
  isHighlighted?: boolean;
}

/**
 * Sacral Center - Rectangle (largest motor center)
 * Life force, sexuality, and work capacity
 * Gates: 5, 14, 29, 59, 9, 3, 42, 27, 34
 */
export function SacralCenter({ state, onClick, onHover, isHighlighted }: SacralCenterProps) {
  return (
    <CenterBase
      name="sacral"
      state={state}
      onClick={onClick}
      onHover={onHover}
      isHighlighted={isHighlighted}
      useOfficialPath={true}
    />
  );
}
