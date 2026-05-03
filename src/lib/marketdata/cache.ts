// Thin caching layer over AssetPrice. Pages call into here to resolve a
// "current" price without worrying about TTLs or provider failures.
//
// Pattern: AssetSymbol rows are populated by the ticker-search route on
// first lookup, so by the time a downstream page asks for a price, the
// row exists and its `id` is the AssetPrice PK.

import type { AssetSymbol } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMarketDataProvider } from "./client";

const DEFAULT_TTL_MS = 15 * 60 * 1000;

// `client.ts` stashes the provider-specific lookup key in `exchange` for
// crypto and forex (CoinGecko coin id, Finnhub OANDA pair). Stocks quote
// against the bare ticker.
function lookupKeyFor(symbol: AssetSymbol): string {
  if (
    (symbol.assetType === "CRYPTO" || symbol.assetType === "FOREX") &&
    symbol.exchange
  ) {
    return symbol.exchange;
  }
  return symbol.symbol;
}

export async function refreshAssetPrice(symbol: AssetSymbol) {
  const provider = getMarketDataProvider();
  const quote = await provider.getQuote(lookupKeyFor(symbol), symbol.assetType);
  if (!quote) return null;
  await prisma.assetPrice.upsert({
    where: { symbolId: symbol.id },
    create: {
      symbolId: symbol.id,
      price: quote.price,
      changePct: quote.changePct,
    },
    update: {
      price: quote.price,
      changePct: quote.changePct,
      fetchedAt: new Date(),
    },
  });
  return quote;
}

export async function getCachedPrice(
  symbol: AssetSymbol,
  ttlMs: number = DEFAULT_TTL_MS,
) {
  const existing = await prisma.assetPrice.findUnique({
    where: { symbolId: symbol.id },
  });
  if (existing && Date.now() - existing.fetchedAt.getTime() < ttlMs) {
    return existing;
  }
  try {
    await refreshAssetPrice(symbol);
  } catch {
    // Provider hiccup — fall back to whatever stale row we already have.
  }
  return prisma.assetPrice.findUnique({ where: { symbolId: symbol.id } });
}

export async function getCachedPrices(
  symbols: AssetSymbol[],
  ttlMs?: number,
) {
  const entries = await Promise.all(
    symbols.map(
      async (s) => [s.id, await getCachedPrice(s, ttlMs)] as const,
    ),
  );
  return new Map(entries);
}
