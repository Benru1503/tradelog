"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import Decimal from "decimal.js";
import { toast } from "sonner";
import type { WatchItem } from "@prisma/client";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { deleteWatchItem } from "@/app/(app)/watchlist/actions";

export interface WatchlistRow {
  item: WatchItem;
  lastPrice: number | null;
  changePct: number | null;
}

export function WatchlistTable({ rows }: { rows: WatchlistRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleRemove(id: string, asset: string) {
    if (!confirm(`Remove ${asset} from watchlist?`)) return;
    startTransition(async () => {
      const result = await deleteWatchItem(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Removed ${asset}`);
      router.refresh();
    });
  }

  if (rows.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-bg-card overflow-hidden transition-opacity",
        pending && "opacity-60",
      )}
    >
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-fg-muted border-b border-border">
              <th className="px-5 py-3.5 text-left font-medium">Symbol</th>
              <th className="px-5 py-3.5 text-left font-medium">Type</th>
              <th className="px-5 py-3.5 text-right font-medium">Last</th>
              <th className="px-5 py-3.5 text-right font-medium">Day Δ</th>
              <th className="px-5 py-3.5 text-right font-medium">Target</th>
              <th className="px-5 py-3.5 text-right font-medium">Distance</th>
              <th className="px-5 py-3.5 text-left font-medium">Note</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, lastPrice, changePct }) => {
              const target = item.targetPrice
                ? new Decimal(item.targetPrice.toString()).toNumber()
                : null;
              const distance =
                target != null && lastPrice != null && lastPrice > 0
                  ? ((target - lastPrice) / lastPrice) * 100
                  : null;
              // Hit conditions: BUY = price fell to or below target; SELL = price
              // rose to or above target.
              const targetHit =
                target != null && lastPrice != null && item.targetDirection
                  ? item.targetDirection === "BUY"
                    ? lastPrice <= target
                    : lastPrice >= target
                  : false;
              return (
                <tr
                  key={item.id}
                  className="border-b border-border last:border-0 hover:bg-bg-elevated/40 transition-colors"
                >
                  <td className="px-5 py-4 font-semibold">
                    {item.asset}
                    {targetHit && (
                      <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider bg-accent/20 text-accent ring-1 ring-inset ring-accent/30">
                        Target hit
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-fg-muted text-xs uppercase tracking-wider">
                    {item.assetType}
                  </td>
                  <td className="px-5 py-4 text-right font-mono tabular-nums">
                    {lastPrice != null ? formatCurrency(lastPrice) : "—"}
                  </td>
                  <td
                    className={cn(
                      "px-5 py-4 text-right font-mono tabular-nums",
                      changePct == null
                        ? "text-fg-muted"
                        : changePct >= 0
                          ? "text-profit"
                          : "text-loss",
                    )}
                  >
                    {changePct != null ? formatPercent(changePct, { signed: true }) : "—"}
                  </td>
                  <td className="px-5 py-4 text-right font-mono tabular-nums">
                    {target != null ? (
                      <span>
                        {item.targetDirection === "BUY" ? "≤ " : "≥ "}
                        {formatCurrency(target)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td
                    className={cn(
                      "px-5 py-4 text-right font-mono tabular-nums",
                      distance == null
                        ? "text-fg-muted"
                        : targetHit
                          ? "text-accent"
                          : "text-fg-muted",
                    )}
                  >
                    {distance != null ? formatPercent(distance, { signed: true }) : "—"}
                  </td>
                  <td className="px-5 py-4 text-fg-muted text-xs max-w-xs truncate">
                    {item.note ?? ""}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemove(item.id, item.asset)}
                      aria-label={`Remove ${item.asset}`}
                      className="text-fg-subtle hover:text-loss transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
