"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, TrendingDown, TrendingUp } from "lucide-react";
import type { AssetType, PredictionDirection, PredictionHorizon } from "@prisma/client";
import { cn, formatDate } from "@/lib/utils";
import { deletePrediction } from "@/app/(app)/predict/actions";

export interface PredictionRow {
  id: string;
  symbol: string;
  assetType: AssetType;
  horizon: PredictionHorizon;
  direction: PredictionDirection;
  pUp: number;
  priceAt: number;
  createdAt: string;
  resolvesAt: string;
  outcome: "HIT" | "MISS" | null;
  resolvedPrice: number | null;
}

function fmtPrice(value: number): string {
  const decimals = value >= 1 ? 2 : 6;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function OutcomePill({ row }: { row: PredictionRow }) {
  if (row.outcome === "HIT") {
    return (
      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-profit/15 text-profit">
        Hit
      </span>
    );
  }
  if (row.outcome === "MISS") {
    return (
      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-loss/15 text-loss">
        Miss
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-fg-muted/10 text-fg-muted">
      Scores {formatDate(row.resolvesAt)}
    </span>
  );
}

export function PredictionsHistory({ rows }: { rows: PredictionRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete(row: PredictionRow) {
    if (
      !confirm(
        `Delete the ${row.symbol} ${row.horizon === "D1" ? "next-day" : "next-week"} prediction?`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deletePrediction(row.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Prediction deleted");
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-fg-subtle py-4">
        No predictions yet. Run one above — every forecast lands here and gets scored against the
        real price once its horizon passes.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-fg-subtle border-b border-border">
            <th className="py-2 pr-3 font-medium">Asset</th>
            <th className="py-2 pr-3 font-medium">Horizon</th>
            <th className="py-2 pr-3 font-medium">Call</th>
            <th className="py-2 pr-3 font-medium text-right">Confidence</th>
            <th className="py-2 pr-3 font-medium text-right">Ref price</th>
            <th className="py-2 pr-3 font-medium text-right">Resolved</th>
            <th className="py-2 pr-3 font-medium">Made</th>
            <th className="py-2 pr-3 font-medium">Status</th>
            <th className="py-2 font-medium sr-only">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const up = row.direction === "UP";
            const conf = Math.max(row.pUp, 1 - row.pUp) * 100;
            return (
              <tr key={row.id} className="border-b border-border/40 last:border-0">
                <td className="py-2.5 pr-3 font-mono font-semibold">{row.symbol}</td>
                <td className="py-2.5 pr-3 text-fg-muted text-xs">
                  {row.horizon === "D1" ? "Next day" : "Next week"}
                </td>
                <td className="py-2.5 pr-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 font-medium",
                      up ? "text-profit" : "text-loss",
                    )}
                  >
                    {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {up ? "Up" : "Down"}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                  {conf.toFixed(1)}%
                </td>
                <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                  {fmtPrice(row.priceAt)}
                </td>
                <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-fg-muted">
                  {row.resolvedPrice === null ? "—" : fmtPrice(row.resolvedPrice)}
                </td>
                <td className="py-2.5 pr-3 text-fg-muted text-xs whitespace-nowrap">
                  {formatDate(row.createdAt)}
                </td>
                <td className="py-2.5 pr-3">
                  <OutcomePill row={row} />
                </td>
                <td className="py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(row)}
                    disabled={pending}
                    aria-label={`Delete ${row.symbol} prediction`}
                    className="p-1.5 rounded-md text-fg-subtle hover:text-loss hover:bg-loss/10 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
