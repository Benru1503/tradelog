import Link from "next/link";
import type { Trade } from "@prisma/client";
import { cn, formatCurrency, formatDate, pnlColorClass } from "@/lib/utils";

export function RecentTrades({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) {
    return (
      <div className="text-sm text-fg-subtle py-8 text-center">
        No trades yet.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {trades.map((t) => (
        <li key={t.id}>
          <Link
            href={`/trades/${t.id}`}
            className="flex items-center justify-between gap-4 py-3 hover:text-accent"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{t.asset}</span>
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded", t.direction === "LONG" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss")}>
                  {t.direction}
                </span>
              </div>
              <div className="text-xs text-fg-subtle mt-0.5">
                {formatDate(t.entryDate)} · {t.assetType}
              </div>
            </div>
            <div className={cn("text-sm font-mono", pnlColorClass(t.pnl))}>
              {t.pnl ? formatCurrency(t.pnl, { signed: true }) : "Open"}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
