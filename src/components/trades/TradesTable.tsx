"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { Trade } from "@prisma/client";
import { cn, formatCurrency, formatDate, formatNumber, formatPercent, pnlColorClass } from "@/lib/utils";
import { DirectionBadge } from "@/components/ui/DirectionBadge";
import { StatusPill } from "@/components/ui/StatusPill";

const COLS: { key: string; label: string; sortable?: boolean; align?: "right" }[] = [
  { key: "entryDate", label: "Date", sortable: true },
  { key: "asset", label: "Asset", sortable: true },
  { key: "assetType", label: "Type" },
  { key: "direction", label: "Side" },
  { key: "entryPrice", label: "Entry", align: "right" },
  { key: "exitPrice", label: "Exit", align: "right" },
  { key: "quantity", label: "Qty", align: "right" },
  { key: "pnl", label: "P&L", sortable: true, align: "right" },
  { key: "pnlPercent", label: "%", sortable: true, align: "right" },
  { key: "status", label: "Status" },
];

export function TradesTable({ trades }: { trades: Trade[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const sortField = params.get("sort") ?? "entryDate";
  const sortDir = (params.get("dir") ?? "desc") as "asc" | "desc";

  function toggleSort(field: string) {
    const next = new URLSearchParams(params.toString());
    if (sortField === field) {
      next.set("dir", sortDir === "asc" ? "desc" : "asc");
    } else {
      next.set("sort", field);
      next.set("dir", "desc");
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-bg-card overflow-hidden transition-opacity",
        pending && "opacity-60",
      )}
      data-testid="trades-table"
    >
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-fg-muted border-b border-border">
              {COLS.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-5 py-3.5 font-medium",
                    c.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {c.sortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-fg transition-colors"
                      onClick={() => toggleSort(c.key)}
                    >
                      {c.label}
                      {sortField === c.key ? (
                        sortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={12} className="opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr
                key={t.id}
                data-testid="trade-row"
                data-trade-id={t.id}
                role="link"
                tabIndex={0}
                aria-label={`View ${t.asset} trade`}
                onClick={() => router.push(`/trades/${t.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/trades/${t.id}`);
                  }
                }}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-bg-elevated/40 focus:bg-bg-elevated/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 transition-colors"
              >
                <td className="px-5 py-4 whitespace-nowrap text-fg-muted font-mono text-xs">
                  {formatDate(t.entryDate)}
                </td>
                <td className="px-5 py-4 font-semibold">{t.asset}</td>
                <td className="px-5 py-4 text-fg-muted text-xs uppercase tracking-wider">
                  {t.assetType}
                </td>
                <td className="px-5 py-4">
                  <DirectionBadge direction={t.direction} />
                </td>
                <td className="px-5 py-4 text-right font-mono tabular-nums">
                  {formatNumber(t.entryPrice, 2)}
                </td>
                <td className="px-5 py-4 text-right font-mono tabular-nums text-fg-muted">
                  {t.exitPrice ? formatNumber(t.exitPrice, 2) : "—"}
                </td>
                <td className="px-5 py-4 text-right font-mono tabular-nums text-fg-muted">
                  {formatNumber(t.quantity, 4)}
                </td>
                <td
                  className={cn(
                    "px-5 py-4 text-right font-mono tabular-nums font-medium",
                    pnlColorClass(t.pnl),
                  )}
                >
                  {t.pnl ? formatCurrency(t.pnl, { signed: true }) : "—"}
                </td>
                <td className={cn("px-5 py-4 text-right font-mono tabular-nums", pnlColorClass(t.pnlPercent))}>
                  {t.pnlPercent ? formatPercent(t.pnlPercent, { signed: true }) : "—"}
                </td>
                <td className="px-5 py-4">
                  <StatusPill status={t.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
