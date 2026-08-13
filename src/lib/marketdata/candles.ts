// Historical OHLC candles for the in-trade chart. Server-side only —
// providers' API keys live in `process.env`.
//
// Unlike `cache.ts`, candles are not persisted: pages call `getCandles()`
// at request time. If the provider returns nothing (no key, paid tier,
// network hiccup), we return null and let the UI render a graceful
// "Historical chart unavailable" message instead of crashing.

import type { AssetSymbol } from "@prisma/client";
import { yahooProvider } from "./providers/yahoo";
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

export async function getCandles(
  symbol: AssetSymbol,
  range: CandleRange,
): Promise<Candle[] | null> {
  if (symbol.assetType === "CRYPTO") {
    // CoinGecko's coin id ("bitcoin"), not the display ticker.
    return coingeckoProvider.getCandles(symbol.exchange ?? symbol.symbol, range);
  }
  // Yahoo, not Finnhub: Finnhub's free tier doesn't serve historical
  // /stock/candle or /forex/candle at all. Yahoo wants the bare display
  // symbol ("AAPL", "EUR/USD") — it does its own forex reformatting.
  return yahooProvider.getCandles(symbol.symbol, symbol.assetType, range);
}
