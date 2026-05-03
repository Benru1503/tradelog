import dynamic from "next/dynamic";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { decoratePosition } from "@/lib/positions";
import { enrichStockSectors } from "@/lib/marketdata/sectors";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { BarChart3 } from "lucide-react";
import type { HeatmapTile } from "@/components/analytics/SectorHeatmap";

const SectorHeatmap = dynamic(
  () => import("@/components/analytics/SectorHeatmap").then((m) => m.SectorHeatmap),
  { loading: () => <div className="h-80 animate-pulse bg-bg-elevated/40 rounded" /> },
);
const PositionDonut = dynamic(
  () => import("@/components/positions/PositionDonut").then((m) => m.PositionDonut),
  { loading: () => <div className="h-56 animate-pulse bg-bg-elevated/40 rounded" /> },
);

// Bucket non-stock holdings by asset class so the heatmap shows the whole
// portfolio, not just stocks. Keeps the visual grouping coherent — Bitcoin
// and EUR/USD don't have a "sector" the way AAPL does.
function bucketFor(assetType: string, sector: string | null): string {
  if (assetType === "CRYPTO") return "Crypto";
  if (assetType === "FOREX") return "Forex";
  return sector ?? "Stocks (other)";
}

export default async function AnalyticsPage() {
  const user = await requireUser();

  const positions = await prisma.position.findMany({
    where: { userId: user.id, status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });

  if (positions.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Analytics"
          subtitle="Sector breakdown and allocation drift"
        />
        <EmptyState
          icon={<BarChart3 size={32} />}
          title="No open positions yet"
          description="Open a trade to start seeing sector and allocation analytics."
        />
      </div>
    );
  }

  // Pull AssetSymbol rows for held positions, including the latest cached
  // price. We then enrich any missing sectors via Finnhub (no-op for crypto/
  // forex). All best-effort — if the provider is down or out of quota the
  // page still renders.
  const symbols = await prisma.assetSymbol.findMany({
    where: {
      OR: positions.map((p) => ({
        symbol: p.asset,
        assetType: p.assetType,
      })),
    },
    include: { prices: true },
  });
  await enrichStockSectors(symbols);

  const symbolMap = new Map(
    symbols.map((s) => [`${s.symbol}:${s.assetType}`, s] as const),
  );

  const tiles: HeatmapTile[] = [];
  const allocSlices: Array<{ asset: string; value: number; pct: number }> = [];

  for (const p of positions) {
    const sym = symbolMap.get(`${p.asset}:${p.assetType}`);
    const priceRow = sym?.prices[0];
    const price = priceRow
      ? {
          price: new Decimal(priceRow.price.toString()).toNumber(),
          fetchedAt: priceRow.fetchedAt,
        }
      : null;
    const decorated = decoratePosition(p, price);
    const allocation = decorated.marketValue ?? decorated.costBasis;
    if (allocation <= 0) continue;
    tiles.push({
      positionId: p.id,
      asset: p.asset,
      sector: bucketFor(p.assetType, sym?.sector ?? null),
      size: allocation,
      unrealizedPct: decorated.unrealizedPct,
    });
    allocSlices.push({ asset: p.asset, value: allocation, pct: 0 });
  }

  const totalAlloc = allocSlices.reduce((a, b) => a + b.value, 0);
  for (const s of allocSlices) {
    s.pct = totalAlloc > 0 ? (s.value / totalAlloc) * 100 : 0;
  }
  allocSlices.sort((a, b) => b.value - a.value);

  const livePriceCount = tiles.filter((t) => t.unrealizedPct != null).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        subtitle="Sector breakdown and allocation"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>Sector heatmap</CardTitle>
            <span className="text-[11px] text-fg-subtle">
              Tile size = allocation · color = unrealized P&amp;L
            </span>
          </div>
        </CardHeader>
        {livePriceCount === 0 && (
          <div className="mb-3 rounded-md border border-border/60 bg-bg-elevated/40 px-3 py-2 text-xs text-fg-subtle">
            No live prices yet — tiles are sized by cost basis and colored
            neutral. Add a Finnhub key (stocks/forex) and watch the colors
            populate as quotes flow.
          </div>
        )}
        <SectorHeatmap tiles={tiles} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Allocation by asset</CardTitle>
          </CardHeader>
          <PositionDonut slices={allocSlices} />
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top weights</CardTitle>
          </CardHeader>
          <ul className="space-y-2">
            {allocSlices.slice(0, 8).map((s) => (
              <li key={s.asset} className="flex items-center gap-3 text-sm">
                <span className="font-semibold w-16 truncate">{s.asset}</span>
                <div className="flex-1 h-2 rounded-full bg-bg-elevated overflow-hidden">
                  <div
                    className="h-full bg-accent/60 rounded-full"
                    style={{ width: `${Math.min(100, s.pct)}%` }}
                  />
                </div>
                <span className="text-xs text-fg-muted font-mono tabular-nums w-14 text-right">
                  {s.pct.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <p className="text-[11px] text-fg-subtle">
        30-day allocation drift coming once we start snapshotting daily
        position values — needs a scheduled job we haven&apos;t built yet.
      </p>
    </div>
  );
}
