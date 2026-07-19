// Resolve a ticker the user typed/picked into an AssetSymbol row. The
// autocomplete usually pre-populates the row via /api/tickers/search, but a
// user could also type a ticker manually (Enter on free-text), in which
// case we run a fresh provider lookup and upsert the result.
//
// Shared by the Playground and Predict server actions.

import type { AssetType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMarketDataProvider } from "./client";

export async function resolveSymbol(asset: string, assetType: AssetType) {
  const upper = asset.toUpperCase();
  const cached = await prisma.assetSymbol.findUnique({
    where: { symbol_assetType: { symbol: upper, assetType } },
  });
  if (cached) return cached;
  const fresh = await getMarketDataProvider().searchSymbols(upper, assetType);
  const match =
    fresh.find((r) => r.symbol === upper) ?? fresh.find((r) => r.assetType === assetType);
  if (!match) return null;
  return prisma.assetSymbol.upsert({
    where: { symbol_assetType: { symbol: match.symbol, assetType: match.assetType } },
    create: {
      symbol: match.symbol,
      name: match.name,
      assetType: match.assetType,
      exchange: match.exchange ?? null,
      sector: match.sector ?? null,
    },
    update: {
      name: match.name,
      exchange: match.exchange ?? null,
      sector: match.sector ?? null,
      refreshedAt: new Date(),
    },
  });
}
