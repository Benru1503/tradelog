import * as React from "react";
import { cn } from "@/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-10 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-border-strong disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";
