"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex w-full rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm",
          "px-4 py-3 text-[15px] leading-relaxed text-foreground",
          "placeholder:text-muted-foreground/60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/30",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "transition-all duration-200",
          "resize-none",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };

