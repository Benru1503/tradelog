import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[100px] w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-border-strong disabled:opacity-50 resize-y",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
