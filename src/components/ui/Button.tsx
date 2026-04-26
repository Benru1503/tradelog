import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary: "bg-bg-card border border-border text-fg hover:border-border-strong",
  ghost: "text-fg-muted hover:text-fg hover:bg-bg-card",
  danger: "bg-loss/10 border border-loss/30 text-loss hover:bg-loss/20",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-accent/50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
