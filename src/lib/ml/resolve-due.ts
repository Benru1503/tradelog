// Lazy resolution of due predictions. The /predict page calls this before
// querying history, so outcomes fill in the first time anyone looks after
// the horizon has elapsed — no cron needed at this scale.
//
// The resolved price is the cached/live quote at view time, not the exact
// close at `resolvesAt`. For a friends-scale diary that approximation is
// acceptable and documented (docs/ml-prediction.md); rows record the
// actual `resolvedAt` timestamp so late resolutions are visible.

import { prisma } from "@/lib/prisma";
import { getCachedPrice } from "@/lib/marketdata/cache";
import { resolveSymbol } from "@/lib/marketdata/resolve";
import { decideOutcome } from "./lifecycle";

const BATCH_LIMIT = 25;

export async function resolveDuePredictions(userId: string): Promise<void> {
  const due = await prisma.prediction.findMany({
    where: { userId, resolvedAt: null, resolvesAt: { lte: new Date() } },
    orderBy: { resolvesAt: "asc" },
    take: BATCH_LIMIT,
  });
  if (due.length === 0) return;

  // One quote per distinct symbol, not per row.
  const priceBySymbol = new Map<string, number>();
  for (const p of due) {
    const key = `${p.symbol}:${p.assetType}`;
    if (priceBySymbol.has(key)) continue;
    try {
      const symbolRow = await resolveSymbol(p.symbol, p.assetType);
      if (!symbolRow) continue;
      const price = await getCachedPrice(symbolRow);
      if (price) priceBySymbol.set(key, Number(price.price));
    } catch {
      // Provider hiccup — leave unresolved, the next page view retries.
    }
  }

  const now = new Date();
  for (const p of due) {
    const price = priceBySymbol.get(`${p.symbol}:${p.assetType}`);
    if (price === undefined || !Number.isFinite(price) || price <= 0) continue;
    await prisma.prediction.update({
      where: { id: p.id },
      data: {
        resolvedAt: now,
        resolvedPrice: price,
        outcome: decideOutcome(p.direction, Number(p.priceAt), price),
      },
    });
  }
}
