"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Search, Loader2, Globe, Check } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export type LocationResult = {
  id: string;
  name: string;
  fullName: string;
  region: string;
  country: string;
  timezone: string;
};

interface LocationSearchProps {
  value: LocationResult | null;
  onChange: (location: LocationResult | null) => void;
  onTimezoneDetected?: (timezone: string) => void;
}

export function LocationSearch({
  value,
  onChange,
  onTimezoneDetected,
}: LocationSearchProps) {
  const [query, setQuery] = useState(value?.fullName || "");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const [mounted, setMounted] = useState(false);

  // Client-side only for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update dropdown position when results change or input is focused
  const updateDropdownPosition = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8, // 8px margin
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  // Search API
  const searchLocations = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/locations/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setResults(data);
        setIsOpen(data.length > 0);
        setSelectedIndex(0);
        updateDropdownPosition();
      }
    } catch (error) {
      console.error("Error searching locations:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [updateDropdownPosition]);

  // Debounced search
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newQuery = e.target.value;
      setQuery(newQuery);

      // Clear selection when typing
      if (value && newQuery !== value.fullName) {
        onChange(null);
      }

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        searchLocations(newQuery);
      }, 300);
    },
    [value, onChange, searchLocations]
  );

  // Handle selection
  const handleSelect = useCallback(
    (location: LocationResult) => {
      setQuery(location.fullName);
      onChange(location);
      setIsOpen(false);

      // Auto-populate timezone
      if (onTimezoneDetected && location.timezone) {
        onTimezoneDetected(location.timezone);
      }
    },
    [onChange, onTimezoneDetected]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || results.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          break;
      }
    },
    [isOpen, results, selectedIndex, handleSelect]
  );

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update dropdown position on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    
    const handlePositionUpdate = () => updateDropdownPosition();
    
    window.addEventListener("scroll", handlePositionUpdate, true);
    window.addEventListener("resize", handlePositionUpdate);
    
    return () => {
      window.removeEventListener("scroll", handlePositionUpdate, true);
      window.removeEventListener("resize", handlePositionUpdate);
    };
  }, [isOpen, updateDropdownPosition]);

  const isSelected = value !== null;

  return (
    <div ref={containerRef} className="relative">
      {/* Input field */}
      <div
        className={cn(
          "relative group transition-all duration-300",
          isSelected && "ring-2 ring-emerald-500/30"
        )}
      >
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
          {loading ? (
            <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
          ) : isSelected ? (
            <Check className="w-5 h-5 text-emerald-400" />
          ) : (
            <Search className="w-5 h-5 text-zinc-500 group-focus-within:text-violet-400 transition-colors" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            updateDropdownPosition();
            if (results.length > 0 && !isSelected) {
              setIsOpen(true);
            }
          }}
          placeholder="Buscar cidade..."
          className={cn(
            "w-full h-14 pl-12 pr-4 rounded-2xl",
            "bg-zinc-900/80 border border-white/10",
            "text-base text-white placeholder:text-zinc-600",
            "focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20",
            "transition-all duration-300",
            isSelected && "border-emerald-500/30 bg-emerald-500/5"
          )}
        />

        {/* Country flag/indicator */}
        {isSelected && value && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute right-4 top-1/2 -translate-y-1/2"
          >
            <span className="text-xs text-emerald-400 font-medium px-2 py-1 bg-emerald-500/10 rounded-full">
              {value.country}
            </span>
          </motion.div>
        )}
      </div>

      {/* Timezone badge when selected */}
      <AnimatePresence>
        {isSelected && value && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="mt-3 flex items-center gap-2"
          >
            <Globe className="w-4 h-4 text-violet-400" />
            <span className="text-sm text-muted-foreground">
              Fuso horário detectado:{" "}
              <span className="text-violet-400 font-medium">{value.timezone}</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dropdown results - rendered via portal to escape modal overflow */}
      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: "fixed",
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
                zIndex: 9999,
              }}
              className="overflow-hidden"
            >
              <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* Hint text */}
                <div className="px-4 py-2 border-b border-white/5">
                  <p className="text-xs text-zinc-500">
                    Selecione sua cidade de nascimento
                  </p>
                </div>

                {/* Results list */}
                <div className="max-h-64 overflow-y-auto">
                  {results.map((location, idx) => (
                    <motion.button
                      key={location.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => handleSelect(location)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "w-full px-4 py-3 flex items-start gap-3 text-left transition-all",
                        idx === selectedIndex
                          ? "bg-violet-500/10"
                          : "hover:bg-white/5"
                      )}
                    >
                      <MapPin
                        className={cn(
                          "w-4 h-4 mt-0.5 flex-shrink-0 transition-colors",
                          idx === selectedIndex ? "text-violet-400" : "text-zinc-500"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "font-medium truncate",
                            idx === selectedIndex ? "text-white" : "text-zinc-300"
                          )}
                        >
                          {location.name}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">
                          {location.region}, {location.country}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="text-[10px] text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">
                          {location.timezone.split("/")[1]?.replace("_", " ") || location.timezone}
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* No results state - also via portal */}
      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && results.length === 0 && query.length >= 2 && !loading && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                position: "fixed",
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
                zIndex: 9999,
              }}
            >
              <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center">
                <MapPin className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">
                  Nenhuma cidade encontrada para "{query}"
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  Tente outro nome ou grafia
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

