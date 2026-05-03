import Link from "next/link";
import type { Trade } from "@prisma/client";
import { cn, formatCurrency, pnlColorClass } from "@/lib/utils";
import { DirectionBadge } from "@/components/ui/DirectionBadge";
import { StatusPill } from "@/components/ui/StatusPill";

export function RecentTrades({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) {
    return (
      <div className="text-sm text-fg-subtle py-8 text-center">No trades yet.</div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {trades.map((t) => (
        <li key={t.id}>
          <Link
            href={`/trades/${t.id}`}
            className="flex items-center justify-between gap-4 py-3.5 group"
          >
            <div className="min-w-0 flex-1 flex items-baseline gap-2">
              <span className="font-semibold group-hover:text-accent transition-colors">
                {t.asset}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-fg-subtle">
                {t.assetType}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <DirectionBadge direction={t.direction} size="sm" />
              <span
                className={cn(
                  "text-sm font-mono tabular-nums w-24 text-right",
                  pnlColorClass(t.pnl),
                )}
              >
                {t.pnl ? formatCurrency(t.pnl, { signed: true }) : "—"}
              </span>
              <StatusPill status={t.status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
