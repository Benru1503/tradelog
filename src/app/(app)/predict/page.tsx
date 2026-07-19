import { Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  PredictPanel,
  type HoldingChip,
  type ModelCardData,
} from "@/components/predict/PredictPanel";
import { PredictionsHistory, type PredictionRow } from "@/components/predict/PredictionsHistory";
import { MODEL_META } from "@/lib/ml/model";
import { resolveDuePredictions } from "@/lib/ml/resolve-due";

export default async function PredictPage() {
  const user = await requireUser();

  // Fill in outcomes for anything whose horizon has passed, then read.
  await resolveDuePredictions(user.id);

  const [predictions, openPositions] = await Promise.all([
    prisma.prediction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.position.findMany({
      where: { userId: user.id, status: "OPEN" },
      select: { asset: true, assetType: true },
      orderBy: { openedAt: "desc" },
      distinct: ["asset", "assetType"],
      take: 7,
    }),
  ]);

  const holdings: HoldingChip[] = openPositions.map((p) => ({
    asset: p.asset,
    assetType: p.assetType,
  }));

  // Plain-data slice for the client bundle — never pass MODEL_META itself,
  // it drags the artifact JSON into the page payload.
  const modelCard: ModelCardData = {
    version: MODEL_META.version,
    trainedAt: MODEL_META.trainedAt,
    assets: MODEL_META.dataInfo.assets,
    horizons: {
      D1: {
        trees: MODEL_META.horizons.d1.trees,
        testAccuracy: MODEL_META.horizons.d1.testAccuracy,
        testAuc: MODEL_META.horizons.d1.testAuc,
        testBaseRate: MODEL_META.horizons.d1.testBaseRate,
        testRows: MODEL_META.horizons.d1.testRows,
      },
      W1: {
        trees: MODEL_META.horizons.w1.trees,
        testAccuracy: MODEL_META.horizons.w1.testAccuracy,
        testAuc: MODEL_META.horizons.w1.testAuc,
        testBaseRate: MODEL_META.horizons.w1.testBaseRate,
        testRows: MODEL_META.horizons.w1.testRows,
      },
    },
    backtest: {
      threshold: MODEL_META.backtest.threshold,
      feeBps: MODEL_META.backtest.feeBps,
      perAsset: MODEL_META.backtest.perAsset.map((b) => ({
        asset: b.asset,
        windowFrom: b.windowFrom,
        windowTo: b.windowTo,
        strategyRetPct: b.strategyRetPct,
        buyHoldRetPct: b.buyHoldRetPct,
        hitRatePct: b.hitRatePct,
        daysInMarketPct: b.daysInMarketPct,
      })),
    },
  };

  const rows: PredictionRow[] = predictions.map((p) => ({
    id: p.id,
    symbol: p.symbol,
    assetType: p.assetType,
    horizon: p.horizon,
    direction: p.direction,
    pUp: Number(p.pUp),
    priceAt: Number(p.priceAt),
    createdAt: p.createdAt.toISOString(),
    resolvesAt: p.resolvesAt.toISOString(),
    outcome: p.outcome,
    resolvedPrice: p.resolvedPrice === null ? null : Number(p.resolvedPrice),
  }));

  const resolved = rows.filter((r) => r.outcome !== null);
  const hits = resolved.filter((r) => r.outcome === "HIT").length;
  const trackRecord =
    resolved.length > 0
      ? `${hits}/${resolved.length} scored predictions hit (${((hits / resolved.length) * 100).toFixed(0)}%)`
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Predict"
        subtitle="Sandbox — an experimental ML forecast, not financial advice"
        action={<Sparkles size={20} className="text-fg-subtle" />}
      />

      <PredictPanel holdings={holdings} modelCard={modelCard} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>Prediction history</CardTitle>
            {trackRecord && <span className="text-xs text-fg-subtle">{trackRecord}</span>}
          </div>
        </CardHeader>
        <PredictionsHistory rows={rows} />
      </Card>
    </div>
  );
}
