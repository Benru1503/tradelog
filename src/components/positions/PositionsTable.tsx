import Link from "next/link";
import { cn, formatCurrency, formatNumber, formatPercent, pnlColorClass } from "@/lib/utils";
import { DirectionBadge } from "@/components/ui/DirectionBadge";
import type { PositionRow } from "@/lib/positions";

export function PositionsTable({ rows }: { rows: PositionRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-bg-card p-10 text-center text-sm text-fg-subtle">
        No open positions. Create a trade to start a new position.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-fg-muted border-b border-border">
              <th className="px-5 py-3.5 text-left font-medium">Asset</th>
              <th className="px-5 py-3.5 text-left font-medium">Type</th>
              <th className="px-5 py-3.5 text-left font-medium">Side</th>
              <th className="px-5 py-3.5 text-right font-medium">Qty</th>
              <th className="px-5 py-3.5 text-right font-medium">Avg cost</th>
              <th className="px-5 py-3.5 text-right font-medium">Mkt price</th>
              <th className="px-5 py-3.5 text-right font-medium">Unrealized</th>
              <th className="px-5 py-3.5 text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ position, marketPrice, marketValue, unrealizedPnl, unrealizedPct }) => (
              <tr
                key={position.id}
                className="group relative border-b border-border last:border-0 hover:bg-bg-elevated/40 transition-colors"
              >
                <td className="px-5 py-4 font-semibold">
                  <Link
                    href={`/positions/${position.id}`}
                    prefetch
                    className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded"
                  >
                    <span className="sr-only">View {position.asset} position</span>
                  </Link>
                  <span className="relative">{position.asset}</span>
                </td>
                <td className="px-5 py-4 text-fg-muted text-xs uppercase tracking-wider">
                  {position.assetType}
                </td>
                <td className="px-5 py-4">
                  <DirectionBadge direction={position.direction} />
                </td>
                <td className="px-5 py-4 text-right font-mono tabular-nums">
                  {formatNumber(position.totalQty, 4)}
                </td>
                <td className="px-5 py-4 text-right font-mono tabular-nums">
                  {formatCurrency(position.avgCost)}
                </td>
                <td className="px-5 py-4 text-right font-mono tabular-nums text-fg-muted">
                  {marketPrice != null ? formatCurrency(marketPrice) : "—"}
                </td>
                <td
                  className={cn(
                    "px-5 py-4 text-right font-mono tabular-nums font-medium",
                    pnlColorClass(unrealizedPnl ?? null),
                  )}
                >
                  {unrealizedPnl != null
                    ? formatCurrency(unrealizedPnl, { signed: true })
                    : marketValue != null
                      ? "—"
                      : "—"}
                </td>
                <td className={cn("px-5 py-4 text-right font-mono tabular-nums", pnlColorClass(unrealizedPct ?? null))}>
                  {unrealizedPct != null ? formatPercent(unrealizedPct, { signed: true }) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
