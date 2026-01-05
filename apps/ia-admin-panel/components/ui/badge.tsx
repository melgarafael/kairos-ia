"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "secondary" | "outline";
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors";
  const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
    default: "bg-white/10 text-white",
    secondary: "bg-slate-800 text-slate-100 border border-white/10",
    outline: "border border-white/20 text-white"
  };

  return (
    <span className={cn(base, variants[variant], className)} {...props} />
  );
}

