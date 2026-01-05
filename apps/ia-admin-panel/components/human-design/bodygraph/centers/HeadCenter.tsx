"use client";

import { CenterBase } from "./CenterBase";
import type { CenterState } from "../types";

interface HeadCenterProps {
  state: CenterState;
  x?: number;
  y?: number;
  onClick?: (event?: React.MouseEvent) => void;
  onHover?: (isHovering: boolean) => void;
  isHighlighted?: boolean;
}

/**
 * Head Center - Triangle pointing down (top of bodygraph)
 * Pressure center for inspiration and mental pressure
 * Gates: 64, 61, 63
 */
export function HeadCenter({ state, onClick, onHover, isHighlighted }: HeadCenterProps) {
  return (
    <CenterBase
      name="head"
      state={state}
      onClick={onClick}
      onHover={onHover}
      isHighlighted={isHighlighted}
      useOfficialPath={true}
    />
  );
}
