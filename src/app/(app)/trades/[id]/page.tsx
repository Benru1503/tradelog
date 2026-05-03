import Link from "next/link";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { ArrowLeft, Coins, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getCandles } from "@/lib/marketdata/candles";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { DirectionBadge } from "@/components/ui/DirectionBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { TagChips } from "@/components/tags/TagPicker";
import { cn, formatCurrency, formatDateTime, formatNumber, formatPercent, pnlColorClass } from "@/lib/utils";
import { DeleteTradeButton } from "@/components/trades/DeleteTradeButton";
import type { ChartMark } from "@/components/trades/TradeChart";

const TradeChart = dynamic(
  () => import("@/components/trades/TradeChart").then((m) => m.TradeChart),
  { loading: () => <div className="h-80 animate-pulse bg-bg-elevated/40 rounded" /> },
);

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function TradeDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const trade = await prisma.trade.findUnique({
    where: { id: params.id },
    include: { tags: { include: { tag: true } } },
  });
  if (!trade || trade.userId !== user.id || trade.deletedAt) notFound();

  const revisions = await prisma.tradeRevision.findMany({
    where: { tradeId: trade.id },
    orderBy: { changedAt: "desc" },
  });

  // Dividends collected during this trade's holding period. Account-wide
  // for now — `CashFlow` doesn't carry a ticker yet, so we can't filter to
  // this asset. Future: add `assetSymbol` to `CashFlow` and narrow here.
  const dividendWindowEnd = trade.exitDate ?? new Date();
  const dividends = await prisma.cashFlow.findMany({
    where: {
      userId: user.id,
      type: "DIVIDEND",
      occurredAt: {
        gte: trade.entryDate,
        lte: dividendWindowEnd,
      },
    },
  });
  const dividendTotal = dividends.reduce(
    (sum, d) => sum + Number(d.amount.toString()),
    0,
  );

  const trades_tags = trade.tags.map((tt) => tt.tag);

  // Pull candles for an entry-14d → exit+7d (or now) window. Fall back to
  // null when the symbol isn't cached or the provider declines — the chart
  // card renders a graceful empty state instead.
  const symbol = await prisma.assetSymbol.findFirst({
    where: { symbol: trade.asset, assetType: trade.assetType },
  });
  const windowStart = new Date(trade.entryDate.getTime() - 14 * DAY_MS);
  const windowEnd = new Date(
    (trade.exitDate ?? new Date()).getTime() + (trade.exitDate ? 7 * DAY_MS : 0),
  );
  const candles = symbol
    ? await getCandles(symbol, { from: windowStart, to: windowEnd })
    : null;

  const marks: ChartMark[] = [
    {
      time: Math.floor(trade.entryDate.getTime() / 1000),
      price: Number(trade.entryPrice.toString()),
      kind: "entry",
      direction: trade.direction,
      qty: trade.quantity.toString(),
    },
  ];
  if (trade.status === "CLOSED" && trade.exitDate && trade.exitPrice) {
    marks.push({
      time: Math.floor(trade.exitDate.getTime() / 1000),
      price: Number(trade.exitPrice.toString()),
      kind: "exit",
      direction: trade.direction,
      qty: trade.quantity.toString(),
    });
  }

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
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              {trade.asset}
              <DirectionBadge direction={trade.direction} />
              <StatusPill status={trade.status} />
            </h1>
            <p className="text-sm text-fg-muted mt-1">
              {trade.assetType} · entered {formatDateTime(trade.entryDate)}
            </p>
            {dividends.length > 0 && (
              <span
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-profit/10 text-profit ring-1 ring-inset ring-profit/30 px-2.5 py-1 text-xs font-medium"
                title="Account-wide dividends received during this trade's holding period. Asset-level filtering ships with the planned CashFlow.assetSymbol column."
              >
                <Coins size={12} />
                {formatCurrency(dividendTotal)} dividends in window
                <span className="text-fg-subtle font-normal">
                  · {dividends.length} payment{dividends.length === 1 ? "" : "s"}
                </span>
              </span>
            )}
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
        <CardHeader>
          <CardTitle>Price chart</CardTitle>
        </CardHeader>
        {candles && candles.length > 0 ? (
          <TradeChart
            candles={candles}
            marks={marks}
            priceLine={{
              price: Number(trade.entryPrice.toString()),
              label: "Entry",
            }}
          />
        ) : (
          <div className="flex h-72 flex-col items-center justify-center text-center px-6 gap-2">
            <p className="text-sm text-fg-muted">Historical chart unavailable.</p>
            <p className="text-xs text-fg-subtle max-w-md">
              {trade.assetType === "CRYPTO"
                ? "CoinGecko didn't return OHLC for this coin in the requested window."
                : "Stock and forex historical OHLC requires a paid Finnhub tier. Live spot quotes still work on the free tier."}
            </p>
          </div>
        )}
      </Card>

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

      {trades_tags.length > 0 && (
        <Card>
          <div className="text-xs text-fg-muted mb-3">Tags</div>
          <TagChips tags={trades_tags} />
        </Card>
      )}

      {trade.notes && (
        <Card>
          <div className="text-xs text-fg-muted mb-2">Notes</div>
          <p className="text-sm whitespace-pre-wrap">{trade.notes}</p>
        </Card>
      )}

      {revisions.length > 0 && (
        <Card>
          <details>
            <summary className="text-xs text-fg-muted cursor-pointer select-none">
              Edit history ({revisions.length})
            </summary>
            <ul className="mt-3 space-y-2 text-xs font-mono">
              {revisions.map((r) => (
                <li key={r.id} className="flex flex-wrap gap-2 text-fg-muted">
                  <span>{formatDateTime(r.changedAt)}</span>
                  <span className="text-fg">{r.fieldName}</span>
                  <span className="text-loss">{r.oldValue ?? "—"}</span>
                  <span>→</span>
                  <span className="text-profit">{r.newValue ?? "—"}</span>
                </li>
              ))}
            </ul>
          </details>
        </Card>
      )}
    </div>
  );
}
