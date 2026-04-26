import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-6 rounded-lg border border-dashed border-border",
        className,
      )}
    >
      {icon && <div className="text-fg-subtle mb-3">{icon}</div>}
      <h3 className="font-medium text-fg">{title}</h3>
      {description && (
        <p className="text-sm text-fg-muted mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
