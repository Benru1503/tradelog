import { cn } from "@/lib/utils";

export function StatsCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "profit" | "loss" | "neutral";
}) {
  const toneClass =
    tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-fg";
  return (
    <div className="rounded-lg border border-border bg-bg-card p-5">
      <div className="text-xs text-fg-muted">{label}</div>
      <div className={cn("text-2xl font-semibold mt-1.5 font-mono", toneClass)}>{value}</div>
      {hint && <div className="text-xs text-fg-subtle mt-1">{hint}</div>}
    </div>
  );
}
