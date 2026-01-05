"use client";

import { CenterBase } from "./CenterBase";
import type { CenterState } from "../types";

interface ThroatCenterProps {
  state: CenterState;
  x?: number;
  y?: number;
  onClick?: (event?: React.MouseEvent) => void;
  onHover?: (isHovering: boolean) => void;
  isHighlighted?: boolean;
}

/**
 * Throat Center - Rectangle
 * Communication and manifestation center
 * Gates: 62, 23, 56, 35, 12, 45, 33, 8, 31, 20, 16
 */
export function ThroatCenter({ state, onClick, onHover, isHighlighted }: ThroatCenterProps) {
  return (
    <CenterBase
      name="throat"
      state={state}
      onClick={onClick}
      onHover={onHover}
      isHighlighted={isHighlighted}
      useOfficialPath={true}
    />
  );
}
