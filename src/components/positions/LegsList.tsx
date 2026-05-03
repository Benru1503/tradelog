import Link from "next/link";
import Decimal from "decimal.js";
import type { Trade } from "@prisma/client";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn, formatCurrency, formatDate, formatNumber, pnlColorClass } from "@/lib/utils";
import { StatusPill } from "@/components/ui/StatusPill";

// Walks the legs in entry order and shows the running average cost after each
// open leg — the killer "see what averaging did to my basis" view.
export function LegsList({ trades, direction }: { trades: Trade[]; direction: "LONG" | "SHORT" }) {
  if (trades.length === 0) {
    return <div className="py-6 text-sm text-fg-subtle">No legs yet.</div>;
  }

  const sorted = [...trades].sort(
    (a, b) => a.entryDate.getTime() - b.entryDate.getTime(),
  );

  let runningQty = new Decimal(0);
  let runningCost = new Decimal(0);

  return (
    <ul className="divide-y divide-border">
      {sorted.map((t) => {
        // Open legs add to running average; closed legs subtract via realized P&L
        // (we still treat the entry as having entered the position, so we update
        // the running line, then the leg "settles" at exit).
        const qty = new Decimal(t.quantity.toString());
        const entry = new Decimal(t.entryPrice.toString());
        runningQty = runningQty.plus(qty);
        runningCost = runningCost.plus(qty.times(entry));
        const avg = runningQty.gt(0) ? runningCost.dividedBy(runningQty) : new Decimal(0);

        // After exit, decrement running totals so the displayed running average
        // tracks current holdings.
        const isClosed = t.status === "CLOSED";
        if (isClosed) {
          runningQty = runningQty.minus(qty);
          runningCost = runningCost.minus(qty.times(entry));
        }

        const Icon = isClosed ? ArrowDown : ArrowUp;
        const action = isClosed ? "Sold" : direction === "SHORT" ? "Sold short" : "Bought";

        return (
          <li key={t.id} className="relative py-3 px-1 group">
            <Link
              href={`/trades/${t.id}`}
              prefetch
              className="absolute inset-0 rounded focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none"
              aria-label={`View trade ${t.id}`}
            />
            <div className="relative flex items-center gap-4">
              <div
                className={cn(
                  "h-7 w-7 shrink-0 rounded-full flex items-center justify-center",
                  isClosed ? "bg-loss/15 text-loss" : "bg-profit/15 text-profit",
                )}
              >
                <Icon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{action}</span>
                  <span className="font-mono text-xs text-fg-muted">
                    {formatNumber(qty, 4)} @ {formatCurrency(entry)}
                  </span>
                  <StatusPill status={t.status} />
                </div>
                <div className="text-xs text-fg-subtle mt-0.5">
                  {formatDate(t.entryDate)}
                  {isClosed && t.exitDate ? ` → ${formatDate(t.exitDate)}` : ""}
                </div>
              </div>
              <div className="text-right shrink-0">
                {isClosed ? (
                  <div
                    className={cn(
                      "text-sm font-mono tabular-nums font-medium",
                      pnlColorClass(t.pnl ?? null),
                    )}
                  >
                    {t.pnl ? formatCurrency(t.pnl, { signed: true }) : "—"}
                  </div>
                ) : (
                  <div className="text-xs text-fg-subtle">
                    Running avg: <span className="font-mono">{formatCurrency(avg)}</span>
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
