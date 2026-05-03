import { cn } from "@/lib/utils";

type Status = "OPEN" | "CLOSED";

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase",
        status === "OPEN"
          ? "bg-accent/10 text-accent ring-1 ring-inset ring-accent/30"
          : "bg-bg-elevated text-fg-muted ring-1 ring-inset ring-border",
        className,
      )}
    >
      {status}
    </span>
  );
}
