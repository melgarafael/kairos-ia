"use client";

import { CenterBase } from "./CenterBase";
import type { CenterState } from "../types";

interface SolarPlexusCenterProps {
  state: CenterState;
  x?: number;
  y?: number;
  onClick?: (event?: React.MouseEvent) => void;
  onHover?: (isHovering: boolean) => void;
  isHighlighted?: boolean;
}

/**
 * Solar Plexus Center - Triangle pointing right
 * Emotional awareness and motor center
 * Gates: 6, 37, 22, 36, 30, 55, 49
 */
export function SolarPlexusCenter({ state, onClick, onHover, isHighlighted }: SolarPlexusCenterProps) {
  return (
    <CenterBase
      name="solar-plexus"
      state={state}
      onClick={onClick}
      onHover={onHover}
      isHighlighted={isHighlighted}
      useOfficialPath={true}
    />
  );
}
