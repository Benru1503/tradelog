// Historical OHLC candles for the in-trade chart. Server-side only —
// providers' API keys live in `process.env`.
//
// Unlike `cache.ts`, candles are not persisted: pages call `getCandles()`
// at request time. If the provider returns nothing (no key, paid tier,
// network hiccup), we return null and let the UI render a graceful
// "Historical chart unavailable" message instead of crashing.

import type { AssetSymbol } from "@prisma/client";
import { finnhubProvider } from "./providers/finnhub";
import { coingeckoProvider } from "./providers/coingecko";

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface CandleRange {
  from: Date;
  to: Date;
}

// Same logic as `cache.ts:lookupKeyFor` — kept inline rather than re-exported
// so the two files stay independent. Crypto and forex carry the provider's
// real lookup id in `exchange`; stocks quote against the bare ticker.
function lookupKey(symbol: AssetSymbol): string {
  if ((symbol.assetType === "CRYPTO" || symbol.assetType === "FOREX") && symbol.exchange) {
    return symbol.exchange;
  }
  return symbol.symbol;
}

export async function getCandles(
  symbol: AssetSymbol,
  range: CandleRange,
): Promise<Candle[] | null> {
  const key = lookupKey(symbol);
  if (symbol.assetType === "CRYPTO") {
    return coingeckoProvider.getCandles(key, range);
  }
  return finnhubProvider.getCandles(key, symbol.assetType, range);
}
