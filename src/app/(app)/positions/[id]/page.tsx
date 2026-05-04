import { notFound } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { decoratePosition } from "@/lib/positions";
import { getCandles } from "@/lib/marketdata/candles";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { DirectionBadge } from "@/components/ui/DirectionBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { LegsList } from "@/components/positions/LegsList";
import { cn, formatCurrency } from "@/lib/utils";
import type { ChartMark } from "@/components/trades/TradeChart";

const TradeChart = dynamic(
  () => import("@/components/trades/TradeChart").then((m) => m.TradeChart),
  { loading: () => <div className="h-80 animate-pulse bg-bg-elevated/40 rounded" /> },
);

const DAY_MS = 24 * 60 * 60 * 1000;

interface PageProps {
  params: { id: string };
  searchParams: { tab?: "overview" | "legs" | "chart" };
}

export default async function PositionDetailPage({ params, searchParams }: PageProps) {
  const user = await requireUser();
  const tab = searchParams.tab ?? "overview";

  const position = await prisma.position.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      trades: {
        where: { deletedAt: null },
        orderBy: { entryDate: "asc" },
      },
    },
  });
  if (!position) notFound();

  // Pull the cached price for this position's asset, if any.
  const symbol = await prisma.assetSymbol.findFirst({
    where: { symbol: position.asset, assetType: position.assetType },
    include: { prices: true },
  });
  const priceRow = symbol?.prices[0];
  const price = priceRow
    ? {
        price: new Decimal(priceRow.price.toString()).toNumber(),
        fetchedAt: priceRow.fetchedAt,
      }
    : null;
  const decorated = decoratePosition(position, price);

  // Candles + per-leg markers — only fetched when the Chart tab is open so
  // we don't hit the provider on every Overview/Legs view.
  let candles: Awaited<ReturnType<typeof getCandles>> = null;
  const marks: ChartMark[] = [];
  if (tab === "chart" && symbol && position.trades.length > 0) {
    const earliestEntry = position.trades.reduce<Date>(
      (acc, t) => (t.entryDate < acc ? t.entryDate : acc),
      position.trades[0]!.entryDate,
    );
    const latestExit = position.trades.reduce<Date | null>(
      (acc, t) => (t.exitDate && (!acc || t.exitDate > acc) ? t.exitDate : acc),
      null,
    );
    const windowStart = new Date(earliestEntry.getTime() - 14 * DAY_MS);
    const windowEnd = new Date(
      (latestExit ?? new Date()).getTime() + (latestExit ? 7 * DAY_MS : 0),
    );
    candles = await getCandles(symbol, { from: windowStart, to: windowEnd });
    for (const t of position.trades) {
      marks.push({
        time: Math.floor(t.entryDate.getTime() / 1000),
        price: Number(t.entryPrice.toString()),
        kind: "entry",
        direction: t.direction,
        qty: t.quantity.toString(),
      });
      if (t.status === "CLOSED" && t.exitDate && t.exitPrice) {
        marks.push({
          time: Math.floor(t.exitDate.getTime() / 1000),
          price: Number(t.exitPrice.toString()),
          kind: "exit",
          direction: t.direction,
          qty: t.quantity.toString(),
        });
      }
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/positions"
          className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg transition-colors mb-3"
        >
          <ArrowLeft size={14} /> Positions
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{position.asset}</h1>
              <DirectionBadge direction={position.direction} />
              <StatusPill status={position.status === "OPEN" ? "OPEN" : "CLOSED"} />
            </div>
            <p className="text-sm text-fg-muted mt-1 uppercase tracking-wider">
              {position.assetType}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Quantity held"
          value={
            position.status === "CLOSED"
              ? "Closed"
              : decorated.costBasis === 0
                ? "—"
                : String(position.totalQty)
          }
          hint={
            position.status === "CLOSED" ? `${position.trades.length} legs` : "Across open legs"
          }
        />
        <StatsCard
          label="Average cost"
          value={
            new Decimal(position.totalQty.toString()).gt(0) ? formatCurrency(position.avgCost) : "—"
          }
          hint="Weighted across open legs"
        />
        <StatsCard
          label="Market value"
          value={decorated.marketValue != null ? formatCurrency(decorated.marketValue) : "—"}
          hint={
            decorated.marketValue == null
              ? "Awaiting live price"
              : `Cost basis ${formatCurrency(decorated.costBasis)}`
          }
        />
        <StatsCard
          label="P&L"
          value={
            decorated.unrealizedPnl != null
              ? formatCurrency(decorated.unrealizedPnl + Number(position.realizedPnl.toString()), {
                  signed: true,
                })
              : formatCurrency(position.realizedPnl, { signed: true })
          }
          tone={
            Number(position.realizedPnl.toString()) + (decorated.unrealizedPnl ?? 0) > 0
              ? "profit"
              : Number(position.realizedPnl.toString()) + (decorated.unrealizedPnl ?? 0) < 0
                ? "loss"
                : "neutral"
          }
          hint={
            decorated.unrealizedPnl != null
              ? `Realized ${formatCurrency(position.realizedPnl, { signed: true })}`
              : "Realized only"
          }
        />
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        <TabLink href={`/positions/${position.id}`} label="Overview" active={tab === "overview"} />
        <TabLink
          href={`/positions/${position.id}?tab=legs`}
          label={`Legs (${position.trades.length})`}
          active={tab === "legs"}
        />
        <TabLink
          href={`/positions/${position.id}?tab=chart`}
          label="Chart"
          active={tab === "chart"}
        />
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent legs</CardTitle>
            </CardHeader>
            <LegsList trades={position.trades.slice(-5).reverse()} direction={position.direction} />
            {position.trades.length > 5 && (
              <div className="mt-3 text-right">
                <Link
                  href={`/positions/${position.id}?tab=legs`}
                  className="text-xs text-fg-muted hover:text-fg"
                >
                  View all {position.trades.length} →
                </Link>
              </div>
            )}
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Add to position</CardTitle>
            </CardHeader>
            <p className="text-sm text-fg-muted mb-4">
              Adding more {position.asset} to this position will show an averaging preview before
              saving.
            </p>
            <Link
              href={`/trades/new?asset=${encodeURIComponent(position.asset)}&assetType=${position.assetType}&direction=${position.direction}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent text-bg hover:bg-accent-hover h-10 px-4 text-sm font-semibold transition-colors w-full"
            >
              + Add a leg
            </Link>
          </Card>
        </div>
      )}

      {tab === "legs" && (
        <Card>
          <CardHeader>
            <CardTitle>All legs</CardTitle>
          </CardHeader>
          <LegsList trades={position.trades} direction={position.direction} />
        </Card>
      )}

      {tab === "chart" && (
        <Card>
          <CardHeader>
            <CardTitle>Price chart</CardTitle>
          </CardHeader>
          {candles && candles.length > 0 ? (
            <TradeChart
              candles={candles}
              marks={marks}
              priceLine={
                new Decimal(position.totalQty.toString()).gt(0)
                  ? {
                      price: Number(position.avgCost.toString()),
                      label: "Avg cost",
                    }
                  : null
              }
            />
          ) : (
            <div className="flex h-72 flex-col items-center justify-center text-center px-6 gap-2">
              <p className="text-sm text-fg-muted">Historical chart unavailable.</p>
              <p className="text-xs text-fg-subtle max-w-md">
                {position.assetType === "CRYPTO"
                  ? "CoinGecko didn't return OHLC for this coin in the requested window."
                  : "Stock and forex historical OHLC requires a paid Finnhub tier. Live spot quotes still work on the free tier."}
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function TabLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "px-4 py-2 text-sm transition-colors -mb-px border-b-2",
        active ? "text-fg border-accent" : "text-fg-muted border-transparent hover:text-fg",
      )}
    >
      {label}
    </Link>
  );
}
