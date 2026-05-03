"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export const FilterChip = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }
>(({ className, active, children, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      "inline-flex items-center justify-center h-9 px-4 rounded-lg text-sm font-medium transition-colors",
      "ring-1 ring-inset focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
      active
        ? "bg-accent/10 text-accent ring-accent/40"
        : "bg-transparent text-fg-muted ring-border hover:text-fg hover:ring-border-strong",
      className,
    )}
    {...props}
  >
    {children}
  </button>
));
FilterChip.displayName = "FilterChip";
