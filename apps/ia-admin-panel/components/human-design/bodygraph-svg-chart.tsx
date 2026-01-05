"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/ui/cn";
import { resolveTypeMeta } from "./type-meta";
import { Expand, Download, Sparkles, ExternalLink } from "lucide-react";
import { useState, useCallback } from "react";
import Image from "next/image";

interface BodygraphChartProps {
  /** URL to the chart image from Bodygraph API */
  chartUrl?: string | null;
  /** Inline SVG string from Bodygraph API */
  svgContent?: string | null;
  tipo?: string | null;
  className?: string;
  /** Show in compact mode (smaller, no controls) */
  compact?: boolean;
}

/**
 * Bodygraph Chart - The visual heart of Human Design
 * 
 * Supports both:
 * - Inline SVG (preferred, when BODYGRAPH_DESIGN_NAME is configured correctly)
 * - Chart URL (fallback)
 * 
 * Following Jobsian principles:
 * - First 10 seconds impact: Large, beautiful chart as hero element
 * - Simplicity: One visual, no clutter
 * - Details matter: Subtle glow, smooth animations
 * - Empowerment: Download and expand options
 */
export function BodygraphSvgChart({ 
  chartUrl, 
  svgContent,
  tipo, 
  className,
  compact = false 
}: BodygraphChartProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const meta = resolveTypeMeta(tipo);

  // Determine what we have to display
  const hasSvg = !!svgContent;
  const hasValidUrl = !!chartUrl && !chartUrl.endsWith('bodygraphchart.com') && chartUrl.includes('/');
  const hasChart = hasSvg || (hasValidUrl && !imageError);

  // Glow colors per type for ambient effect
  const glowMap: Record<string, string> = {
    manifestor: "shadow-indigo-500/10",
    generator: "shadow-amber-500/10",
    "manifesting generator": "shadow-fuchsia-500/10",
    projector: "shadow-emerald-500/10",
    reflector: "shadow-slate-400/10",
  };
  
  const normalized = tipo?.toLowerCase().trim() || "";
  const glow = glowMap[normalized] || "shadow-zinc-500/10";

  // Border accent colors per type
  const borderMap: Record<string, string> = {
    manifestor: "border-indigo-500/20",
    generator: "border-amber-500/20",
    "manifesting generator": "border-fuchsia-500/20",
    projector: "border-emerald-500/20",
    reflector: "border-slate-400/20",
  };
  const borderAccent = borderMap[normalized] || "border-white/10";

  const handleDownloadSvg = useCallback(() => {
    if (!svgContent) return;
    
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meu-bodygraph-${tipo?.toLowerCase().replace(/\s+/g, "-") || "chart"}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [svgContent, tipo]);

  const handleOpenInNewTab = useCallback(() => {
    if (chartUrl) {
      window.open(chartUrl, "_blank");
    }
  }, [chartUrl]);

  // Placeholder when no chart available
  if (!hasChart) {
    return (
      <div
        className={cn(
          "relative rounded-2xl overflow-hidden",
          "bg-gradient-to-b from-white/[0.02] to-transparent",
          "border border-white/5",
          compact ? "aspect-square" : "aspect-[3/4]",
          className
        )}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.02]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          />
        </div>

        {/* Placeholder content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
          <div
            className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center mb-4",
              "bg-white/5 border border-white/10"
            )}
          >
            <meta.icon className={cn("w-8 h-8", meta.accentClass)} />
          </div>

          <p className="text-xs uppercase tracking-[0.2em] text-white/30 mb-2">
            Bodygraph
          </p>
          <p className={cn("text-lg font-medium mb-4", meta.accentClass)}>
            {meta.label}
          </p>

          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
            <Sparkles className="w-4 h-4 text-white/40" />
            <span className="text-xs text-white/40">
              {imageError 
                ? "Erro ao carregar gráfico" 
                : "Configure BODYGRAPH_DESIGN_NAME para gerar"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Main Chart */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "relative group rounded-2xl overflow-hidden",
          "bg-gradient-to-b from-black/40 to-black/60",
          "border",
          borderAccent,
          "shadow-2xl",
          glow,
          compact ? "aspect-square" : "aspect-[3/4]",
          className
        )}
      >
        {/* Chart Content - SVG or Image */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          {hasSvg ? (
            // Inline SVG
            <div 
              className="w-full h-full flex items-center justify-center"
              dangerouslySetInnerHTML={{ __html: sanitizeSvg(svgContent!) }}
            />
          ) : hasValidUrl ? (
            // Image URL
            <Image
              src={chartUrl!}
              alt={`Bodygraph de ${meta.label}`}
              fill
              className="object-contain p-2"
              onError={() => setImageError(true)}
              unoptimized
            />
          ) : null}
        </div>

        {/* Hover controls (only when not compact) */}
        {!compact && (
          <div className={cn(
            "absolute bottom-4 right-4 flex gap-2",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          )}>
            <button
              onClick={() => setIsExpanded(true)}
              className={cn(
                "p-2 rounded-lg",
                "bg-black/60 backdrop-blur-sm border border-white/10",
                "text-white/60 hover:text-white hover:bg-black/80",
                "transition-all duration-200"
              )}
              title="Expandir"
            >
              <Expand className="w-4 h-4" />
            </button>
            {hasSvg ? (
              <button
                onClick={handleDownloadSvg}
                className={cn(
                  "p-2 rounded-lg",
                  "bg-black/60 backdrop-blur-sm border border-white/10",
                  "text-white/60 hover:text-white hover:bg-black/80",
                  "transition-all duration-200"
                )}
                title="Baixar SVG"
              >
                <Download className="w-4 h-4" />
              </button>
            ) : hasValidUrl ? (
              <button
                onClick={handleOpenInNewTab}
                className={cn(
                  "p-2 rounded-lg",
                  "bg-black/60 backdrop-blur-sm border border-white/10",
                  "text-white/60 hover:text-white hover:bg-black/80",
                  "transition-all duration-200"
                )}
                title="Abrir em nova aba"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        )}

        {/* Subtle corner accent */}
        <div className={cn(
          "absolute top-0 right-0 w-24 h-24",
          "bg-gradient-to-bl from-white/5 to-transparent",
          "pointer-events-none"
        )} />
      </motion.div>

      {/* Fullscreen Modal */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl"
          onClick={() => setIsExpanded(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative max-w-4xl max-h-[90vh] w-full m-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close hint */}
            <p className="absolute -top-10 left-1/2 -translate-x-1/2 text-xs text-white/40">
              Clique fora para fechar
            </p>

            {/* Chart container */}
            <div 
              className={cn(
                "relative rounded-3xl overflow-hidden",
                "bg-gradient-to-b from-black/60 to-black/80",
                "border",
                borderAccent,
                "shadow-2xl",
                glow,
                "aspect-[3/4]"
              )}
            >
              {hasSvg ? (
                <div 
                  className="absolute inset-0 p-8 flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: sanitizeSvg(svgContent!) }}
                />
              ) : hasValidUrl ? (
                <Image
                  src={chartUrl!}
                  alt={`Bodygraph de ${meta.label}`}
                  fill
                  className="object-contain p-4"
                  unoptimized
                />
              ) : null}
            </div>

            {/* Action button */}
            <button
              onClick={hasSvg ? handleDownloadSvg : handleOpenInNewTab}
              className={cn(
                "absolute -bottom-14 left-1/2 -translate-x-1/2",
                "flex items-center gap-2 px-4 py-2 rounded-full",
                "bg-white/10 backdrop-blur-sm border border-white/20",
                "text-white/80 hover:text-white hover:bg-white/20",
                "transition-all duration-200"
              )}
            >
              {hasSvg ? (
                <>
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Baixar em alta resolução</span>
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  <span className="text-sm">Abrir em nova aba</span>
                </>
              )}
            </button>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}

/**
 * Sanitize SVG to prevent XSS while keeping valid SVG content
 */
function sanitizeSvg(svg: string): string {
  // Remove script tags
  let sanitized = svg.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  
  // Remove event handlers (onclick, onload, etc.)
  sanitized = sanitized.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "");
  
  // Ensure SVG has proper viewBox and preserveAspectRatio for responsive scaling
  if (sanitized.includes("<svg") && !sanitized.includes("preserveAspectRatio")) {
    sanitized = sanitized.replace(
      "<svg",
      '<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;max-width:100%;max-height:100%"'
    );
  }
  
  return sanitized;
}
