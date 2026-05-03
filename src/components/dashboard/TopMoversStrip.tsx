"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AssetType } from "@prisma/client";
import { cn, formatCurrency, formatPercent, pnlColorClass } from "@/lib/utils";

export type MoverTrade = {
  id: string;
  asset: string;
  assetType: AssetType;
  pnl: number;
  pnlPercent: number | null;
  exitDate: string;
};

type Scope = "ALL" | "MONTH";

export function TopMoversStrip({ trades }: { trades: MoverTrade[] }) {
  const [scope, setScope] = useState<Scope>("ALL");

  const { winners, losers } = useMemo(() => {
    const cutoff =
      scope === "MONTH"
        ? (() => {
            const d = new Date();
            d.setMonth(d.getMonth() - 1);
            return d.getTime();
          })()
        : 0;
    const inScope = trades.filter((t) => new Date(t.exitDate).getTime() >= cutoff);
    const sorted = [...inScope].sort((a, b) => b.pnl - a.pnl);
    return {
      winners: sorted.filter((t) => t.pnl > 0).slice(0, 3),
      losers: sorted.filter((t) => t.pnl < 0).slice(-3).reverse(),
    };
  }, [trades, scope]);

  if (trades.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-fg">Top movers</h3>
        <div className="flex items-center gap-1.5">
          <ScopePill active={scope === "ALL"} onClick={() => setScope("ALL")}>
            All-time
          </ScopePill>
          <ScopePill active={scope === "MONTH"} onClick={() => setScope("MONTH")}>
            This month
          </ScopePill>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
        <Column label="Winners" trades={winners} emptyHint="No winning trades yet" />
        <Column label="Losers" trades={losers} emptyHint="No losing trades — nice." />
      </div>
    </div>
  );
}

function Column({
  label,
  trades,
  emptyHint,
}: {
  label: string;
  trades: MoverTrade[];
  emptyHint: string;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-fg-subtle mb-2">
        {label}
      </div>
      {trades.length === 0 ? (
        <div className="text-xs text-fg-subtle py-2">{emptyHint}</div>
      ) : (
        <ul className="divide-y divide-border">
          {trades.map((t) => (
            <li key={t.id}>
              <Link
                href={`/trades/${t.id}`}
                className="flex items-center justify-between gap-3 py-2 group"
              >
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="font-semibold text-sm group-hover:text-accent transition-colors">
                    {t.asset}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-fg-subtle">
                    {t.assetType}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums text-xs">
                  <span className={cn("w-24 text-right", pnlColorClass(t.pnl))}>
                    {formatCurrency(t.pnl, { signed: true })}
                  </span>
                  <span
                    className={cn(
                      "w-14 text-right",
                      t.pnlPercent == null ? "text-fg-subtle" : pnlColorClass(t.pnlPercent),
                    )}
                  >
                    {t.pnlPercent == null
                      ? "—"
                      : formatPercent(t.pnlPercent, { signed: true })}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScopePill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-6 px-2.5 rounded-full text-[11px] font-medium transition-colors",
        active
          ? "bg-accent text-bg"
          : "bg-bg-elevated/60 text-fg-muted ring-1 ring-inset ring-border hover:text-fg hover:ring-border-strong",
      )}
    >
      {children}
    </button>
  );
}
