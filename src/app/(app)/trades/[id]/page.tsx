import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn, formatCurrency, formatDateTime, formatNumber, formatPercent, pnlColorClass } from "@/lib/utils";
import { DeleteTradeButton } from "@/components/trades/DeleteTradeButton";

export default async function TradeDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const trade = await prisma.trade.findUnique({ where: { id: params.id } });
  if (!trade || trade.userId !== user.id) notFound();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/trades"
          className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
        >
          <ArrowLeft size={14} /> Back to trades
        </Link>
        <div className="flex items-start justify-between gap-4 mt-3">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-3">
              {trade.asset}
              <span className={cn("text-xs px-2 py-0.5 rounded", trade.direction === "LONG" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss")}>
                {trade.direction}
              </span>
              <span className={cn("text-xs px-2 py-0.5 rounded", trade.status === "OPEN" ? "bg-accent/10 text-accent" : "bg-bg-elevated text-fg-muted")}>
                {trade.status}
              </span>
            </h1>
            <p className="text-sm text-fg-muted mt-1">
              {trade.assetType} · entered {formatDateTime(trade.entryDate)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/trades/${trade.id}/edit`}>
              <Button variant="secondary" size="sm">
                <Pencil size={14} /> Edit
              </Button>
            </Link>
            <DeleteTradeButton id={trade.id} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <div className="text-xs text-fg-muted">P&L</div>
          <div className={cn("text-xl font-semibold mt-1 font-mono", pnlColorClass(trade.pnl))}>
            {trade.pnl ? formatCurrency(trade.pnl, { signed: true }) : "—"}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-fg-muted">Return</div>
          <div className={cn("text-xl font-semibold mt-1 font-mono", pnlColorClass(trade.pnlPercent))}>
            {trade.pnlPercent ? formatPercent(trade.pnlPercent, { signed: true }) : "—"}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-fg-muted">Quantity</div>
          <div className="text-xl font-semibold mt-1 font-mono">{formatNumber(trade.quantity, 4)}</div>
        </Card>
        <Card>
          <div className="text-xs text-fg-muted">Fees</div>
          <div className="text-xl font-semibold mt-1 font-mono">{formatCurrency(trade.fees)}</div>
        </Card>
      </div>

      <Card>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div className="flex justify-between border-b border-border pb-2">
            <dt className="text-fg-muted">Entry price</dt>
            <dd className="font-mono">{formatNumber(trade.entryPrice, 4)}</dd>
          </div>
          <div className="flex justify-between border-b border-border pb-2">
            <dt className="text-fg-muted">Exit price</dt>
            <dd className="font-mono">{trade.exitPrice ? formatNumber(trade.exitPrice, 4) : "—"}</dd>
          </div>
          <div className="flex justify-between border-b border-border pb-2">
            <dt className="text-fg-muted">Entry date</dt>
            <dd>{formatDateTime(trade.entryDate)}</dd>
          </div>
          <div className="flex justify-between border-b border-border pb-2">
            <dt className="text-fg-muted">Exit date</dt>
            <dd>{trade.exitDate ? formatDateTime(trade.exitDate) : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-fg-muted">Shared</dt>
            <dd>{trade.isShared ? "Yes" : "No"}</dd>
          </div>
        </dl>
      </Card>

      {trade.notes && (
        <Card>
          <div className="text-xs text-fg-muted mb-2">Notes</div>
          <p className="text-sm whitespace-pre-wrap">{trade.notes}</p>
        </Card>
      )}
    </div>
  );
}
