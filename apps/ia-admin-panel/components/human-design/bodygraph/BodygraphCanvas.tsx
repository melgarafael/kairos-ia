"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

import { BodygraphFullSvg } from "./BodygraphFullSvg";
import type { BodygraphData, CenterName, CenterState } from "./types";
import { BODYGRAPH_COLORS } from "./types";
import { CENTER_BOUNDS } from "./officialPaths";
import { GateNumber, GATE_POSITIONS } from "./gates"; 
import { CenterTooltip } from "./overlays/CenterTooltip";
import { CenterDetailModal } from "./overlays/CenterDetailModal";
import { CenterInfoCard } from "./overlays/CenterInfoCard";

// Center positions map - still useful for legacy or tooltips if needed, but FullSvg handles coords internally.
const CENTER_COORDS: Record<CenterName, { x: number; y: number }> = {
  head: { x: 153, y: 1 },
  ajna: { x: 153, y: 113 },
  throat: { x: 159, y: 224 },
  g: { x: 144, y: 328 },
  heart: { x: 241, y: 393 },
  spleen: { x: 1, y: 468 },
  sacral: { x: 159, y: 500 },
  "solar-plexus": { x: 306, y: 469 },
  root: { x: 159, y: 611 },
};

interface BodygraphCanvasProps {
  data: BodygraphData;
  showGates?: boolean;
  showChannels?: boolean;
  enableZoom?: boolean;
  className?: string;
}

export function BodygraphCanvas({
  data,
  showGates = true,
  showChannels = true,
  enableZoom = true,
  className = "",
}: BodygraphCanvasProps) {
  const [hoveredCenter, setHoveredCenter] = useState<CenterName | null>(null);
  const [selectedCenter, setSelectedCenter] = useState<CenterName | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [cardPosition, setCardPosition] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;

  // Extract gates logic (keep for debug badge if needed, or remove if not used)
  const extractedGates = useMemo(() => {
    // ... (existing logic) ...
    const gatesFromData = new Set<number>();
    if (data.portas) data.portas.forEach(p => gatesFromData.add(Number(p)));
    if (data.planetas_personalidade) Object.values(data.planetas_personalidade).forEach(p => p.Gate && gatesFromData.add(p.Gate));
    if (data.planetas_design) Object.values(data.planetas_design).forEach(p => p.Gate && gatesFromData.add(p.Gate));
    return Array.from(gatesFromData);
  }, [data.portas, data.planetas_personalidade, data.planetas_design]);

  const activeGates = useMemo(() => {
      if (data.portas && data.portas.length > 0) return data.portas.map(Number);
      return extractedGates;
  }, [data.portas, extractedGates]);

  // Helper to get Center State for interactions
  const getCenterState = useCallback(
    (center: CenterName): CenterState => {
      const normalized = center.toLowerCase(); // Simple normalization if needed
      // Better normalization matching the FullSvg logic:
      const definedCenters = data.centros_definidos.map(c => c.toLowerCase().replace(/\s+/g, "-"));
      return definedCenters.includes(normalized) ? "defined" : "open";
    },
    [data.centros_definidos]
  );

  // Handle Interactions
  const handleCenterClick = useCallback((center: CenterName, event: React.MouseEvent) => {
    // Calculate position based on center bounds
    const centerBounds = CENTER_BOUNDS[center];
    if (centerBounds && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      // SVG viewBox is 400x693
      const scaleX = containerRect.width / 400;
      const scaleY = containerRect.height / 693;
      const scale = Math.min(scaleX, scaleY); // Usually preserveAspectRation means min scale is used
      
      // Centering logic if container is larger than aspect ratio
      const renderedWidth = 400 * scale;
      const renderedHeight = 693 * scale;
      const offsetX = (containerRect.width - renderedWidth) / 2;
      const offsetY = (containerRect.height - renderedHeight) / 2;

      setCardPosition({
        x: offsetX + (centerBounds.x + centerBounds.width) * scale,
        y: offsetY + centerBounds.y * scale,
      });
    }
    setSelectedCenter(center);
  }, []);

  const handleCenterHover = useCallback((center: CenterName, isHovering: boolean, event: React.MouseEvent) => {
    if (isHovering) {
       // Simple tooltip positioning near mouse
       const rect = containerRef.current?.getBoundingClientRect();
       if (rect) {
         setTooltipPosition({
           x: event.clientX - rect.left + 10,
           y: event.clientY - rect.top + 10,
         });
       }
       setHoveredCenter(center);
    } else {
       setHoveredCenter(null);
    }
  }, []);

  const getGatesForCenter = useCallback((center: CenterName) => {
      // Keep this helper for tooltips
      return GATE_POSITIONS.filter(g => g.center === center && activeGates.includes(g.gate)).map(g => g.gate);
  }, [activeGates]);


  const svgContent = (
    <motion.div
      className={`w-full h-full ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <BodygraphFullSvg 
        data={data} 
        className="w-full h-full" 
        onCenterClick={handleCenterClick}
        onCenterHover={handleCenterHover}
      />
    </motion.div>
  );

  // Debug Info
  const debugInfo = {
      portasCount: data.portas?.length || 0,
      activeGatesCount: activeGates.length,
      canaisCount: data.canais?.length || 0,
  };

  return (
    <div ref={containerRef} className="relative w-full h-full">
       {/* Debug Badge (keep for now) */}
       {typeof window !== "undefined" && process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-2 left-2 z-20 text-[9px] font-mono bg-black/70 text-white/60 px-2 py-1 rounded border border-white/10">
          Gates: {debugInfo.activeGatesCount} | Channels: {data.canais?.length}
        </div>
      )}

      {enableZoom ? (
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={3}
          centerOnInit
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
                <button onClick={() => zoomIn()} className="p-2 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 hover:bg-white/10 text-white/70"><ZoomIn className="w-4 h-4" /></button>
                <button onClick={() => zoomOut()} className="p-2 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 hover:bg-white/10 text-white/70"><ZoomOut className="w-4 h-4" /></button>
                <button onClick={() => resetTransform()} className="p-2 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 hover:bg-white/10 text-white/70"><Maximize2 className="w-4 h-4" /></button>
              </div>
              <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                {svgContent}
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      ) : (
        svgContent
      )}

      {/* Tooltip */}
      {hoveredCenter && (
        <CenterTooltip
          center={hoveredCenter}
          state={getCenterState(hoveredCenter)}
          gates={getGatesForCenter(hoveredCenter)}
          position={tooltipPosition}
          isVisible={true}
        />
      )}

      {/* Info Card */}
      {selectedCenter && cardPosition && (
        <CenterInfoCard
          center={selectedCenter}
          state={getCenterState(selectedCenter)}
          gates={getGatesForCenter(selectedCenter)}
          anchorPosition={cardPosition}
          containerRef={containerRef}
          onClose={() => { setSelectedCenter(null); setCardPosition(null); }}
        />
      )}

      {/* Mobile Modal */}
      <CenterDetailModal
        center={selectedCenter}
        state={selectedCenter ? getCenterState(selectedCenter) : "open"}
        gates={selectedCenter ? getGatesForCenter(selectedCenter) : []}
        isOpen={!!selectedCenter && !cardPosition}
        onClose={() => { setSelectedCenter(null); setCardPosition(null); }}
      />
    </div>
  );
}


