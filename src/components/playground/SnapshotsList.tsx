"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { formatCurrency, formatPercent, pnlColorClass } from "@/lib/utils";
import { deleteSnapshot } from "@/app/(app)/playground/actions";

export interface SnapshotRow {
  id: string;
  kind: "WHAT_IF" | "DCA";
  asset: string;
  assetName: string;
  summary: string;
  pnl: number;
  pnlPct: number;
  createdAt: string;
}

export function SnapshotsList({ rows }: { rows: SnapshotRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-fg-muted">
        Saved scenarios show up here. None yet — run something above and hit{" "}
        <span className="text-fg">Save snapshot</span>.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <SnapshotItem key={r.id} row={r} />
      ))}
    </ul>
  );
}

function SnapshotItem({ row }: { row: SnapshotRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteSnapshot(row.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Snapshot deleted");
      router.refresh();
    });
  }

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border/60 bg-bg-elevated/40 px-3 py-2.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono font-semibold">{row.asset}</span>
          <span className="text-xs text-fg-muted truncate">{row.assetName}</span>
          <span className="text-[10px] uppercase tracking-wider text-fg-subtle border border-border/60 rounded px-1.5 py-0.5">
            {row.kind === "WHAT_IF" ? "What if" : "DCA"}
          </span>
        </div>
        <div className="text-[11px] text-fg-subtle mt-0.5">{row.summary}</div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-mono font-semibold tabular-nums ${pnlColorClass(row.pnl)}`}>
          {formatCurrency(row.pnl, { signed: true })}
        </div>
        <div className={`text-[11px] font-mono tabular-nums ${pnlColorClass(row.pnl)}`}>
          {formatPercent(row.pnlPct, { signed: true })}
        </div>
      </div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        aria-label="Delete snapshot"
        className="p-1.5 rounded text-fg-subtle hover:text-loss hover:bg-loss/10 disabled:opacity-50"
      >
        <Trash2 size={14} />
      </button>
    </li>
  );
}
