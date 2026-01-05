"use client";

import { CenterBase } from "./CenterBase";
import type { CenterState } from "../types";

interface HeartCenterProps {
  state: CenterState;
  x?: number;
  y?: number;
  onClick?: (event?: React.MouseEvent) => void;
  onHover?: (isHovering: boolean) => void;
  isHighlighted?: boolean;
}

/**
 * Heart Center - Triangle/Pentagon shape pointing down
 * Willpower and ego center (motor)
 * Gates: 21, 40, 26, 51
 */
export function HeartCenter({ state, onClick, onHover, isHighlighted }: HeartCenterProps) {
  return (
    <CenterBase
      name="heart"
      state={state}
      onClick={onClick}
      onHover={onHover}
      isHighlighted={isHighlighted}
      useOfficialPath={true}
    />
  );
}
