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
  const toneClass = tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-fg";
  return (
    <div className="rounded-2xl border border-border bg-bg-card p-5">
      <div className="text-xs text-fg-muted">{label}</div>
      <div
        className={cn("text-3xl font-bold mt-3 tracking-tight font-mono tabular-nums", toneClass)}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-fg-subtle mt-2">{hint}</div>}
    </div>
  );
}
