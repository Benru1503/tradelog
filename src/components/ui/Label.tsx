import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block text-xs font-medium text-fg-muted mb-1.5", className)}
      {...props}
    />
  );
}
