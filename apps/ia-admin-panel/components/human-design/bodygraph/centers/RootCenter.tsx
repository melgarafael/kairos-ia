"use client";

import { CenterBase } from "./CenterBase";
import type { CenterState } from "../types";

interface RootCenterProps {
  state: CenterState;
  x?: number;
  y?: number;
  onClick?: (event?: React.MouseEvent) => void;
  onHover?: (isHovering: boolean) => void;
  isHighlighted?: boolean;
}

/**
 * Root Center - Rectangle (bottom of bodygraph)
 * Pressure and motor center for drive and adrenaline
 * Gates: 53, 60, 52, 19, 39, 41, 58, 38, 54
 */
export function RootCenter({ state, onClick, onHover, isHighlighted }: RootCenterProps) {
  return (
    <CenterBase
      name="root"
      state={state}
      onClick={onClick}
      onHover={onHover}
      isHighlighted={isHighlighted}
      useOfficialPath={true}
    />
  );
}
