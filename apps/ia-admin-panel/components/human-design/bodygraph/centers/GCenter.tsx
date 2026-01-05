"use client";

import { CenterBase } from "./CenterBase";
import type { CenterState } from "../types";

interface GCenterProps {
  state: CenterState;
  x?: number;
  y?: number;
  onClick?: (event?: React.MouseEvent) => void;
  onHover?: (isHovering: boolean) => void;
  isHighlighted?: boolean;
}

/**
 * G Center - Diamond (rotated square)
 * Identity and direction center - The "soul" of the bodygraph
 * Gates: 1, 13, 25, 46, 2, 15, 10, 7
 */
export function GCenter({ state, onClick, onHover, isHighlighted }: GCenterProps) {
  return (
    <CenterBase
      name="g"
      state={state}
      onClick={onClick}
      onHover={onHover}
      isHighlighted={isHighlighted}
      useOfficialPath={true}
    />
  );
}
