"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { Trade } from "@prisma/client";
import { cn, formatCurrency, formatDate, formatNumber, formatPercent, pnlColorClass } from "@/lib/utils";

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
        "rounded-lg border border-border bg-bg-card overflow-hidden transition-opacity",
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
                    "px-4 py-3 font-medium",
                    c.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {c.sortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-fg"
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
                className="group relative border-b border-border last:border-0 hover:bg-bg-elevated/50"
              >
                <td className="px-4 py-3 whitespace-nowrap text-fg-muted">
                  {/* Stretched link covers the row; other in-row links would need z-10 to remain interactive. */}
                  <Link
                    href={`/trades/${t.id}`}
                    prefetch
                    className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded"
                  >
                    <span className="sr-only">View {t.asset} trade</span>
                  </Link>
                  <span className="relative">{formatDate(t.entryDate)}</span>
                </td>
                <td className="px-4 py-3 font-medium">{t.asset}</td>
                <td className="px-4 py-3 text-fg-muted">{t.assetType}</td>
                <td className="px-4 py-3">
                  <span className={cn("text-xs px-2 py-0.5 rounded", t.direction === "LONG" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss")}>
                    {t.direction}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-fg-muted">{formatNumber(t.entryPrice, 2)}</td>
                <td className="px-4 py-3 text-right font-mono text-fg-muted">
                  {t.exitPrice ? formatNumber(t.exitPrice, 2) : "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono text-fg-muted">{formatNumber(t.quantity, 4)}</td>
                <td className={cn("px-4 py-3 text-right font-mono", pnlColorClass(t.pnl))}>
                  {t.pnl ? formatCurrency(t.pnl, { signed: true }) : "—"}
                </td>
                <td className={cn("px-4 py-3 text-right font-mono", pnlColorClass(t.pnlPercent))}>
                  {t.pnlPercent ? formatPercent(t.pnlPercent, { signed: true }) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={cn("text-xs px-2 py-0.5 rounded", t.status === "OPEN" ? "bg-accent/10 text-accent" : "bg-bg-elevated text-fg-muted")}>
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
