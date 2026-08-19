// Historical OHLC candles for stocks/forex via Yahoo Finance's v8 chart
// endpoint — keyless, and unlike Finnhub's free tier, it actually returns
// historical data (Finnhub gates /stock/candle and /forex/candle behind a
// paid plan). Quotes and symbol search still go through Finnhub; this file
// only covers the one gap Finnhub's free tier can't fill.
//
// Deliberately independent from src/lib/ml/history.ts, which hits the same
// Yahoo endpoint for a different purpose. That module has a strict parity
// contract with ml/train.py and must not be coupled to chart-rendering
// changes here — some logic (the forex symbol mangling) is duplicated on
// purpose rather than shared.

import type { AssetType } from "@prisma/client";
import type { Candle } from "../candles";

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const TIMEOUT_MS = 8000;
const DAY_MS = 24 * 60 * 60 * 1000;

async function safeFetch(url: URL): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (tradelog)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

// "EUR/USD" (the app's display symbol) -> Yahoo's "EURUSD=X".
function yahooForexSymbol(symbol: string): string {
  const letters = symbol.replace(/[^A-Za-z]/g, "").toUpperCase();
  return `${letters}=X`;
}

// "BTC" -> Yahoo's "BTC-USD". Covers the coins Yahoo tracks (majors); the
// caller falls back to CoinGecko for anything this comes back empty for.
function yahooCryptoSymbol(symbol: string): string {
  return `${symbol.toUpperCase()}-USD`;
}

function toYahooSymbol(symbol: string, assetType: AssetType): string {
  if (assetType === "FOREX") return yahooForexSymbol(symbol);
  if (assetType === "CRYPTO") return yahooCryptoSymbol(symbol);
  return symbol;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
        }>;
      };
    }>;
  };
}

export const yahooProvider = {
  // Daily OHLC candles for a stock or forex pair, over an arbitrary date
  // range — Yahoo has no fixed lookback ladder the way CoinGecko's free
  // tier does, so the caller's `from`/`to` is sent as-is.
  async getCandles(
    symbol: string,
    assetType: AssetType,
    range: { from: Date; to: Date },
  ): Promise<Candle[] | null> {
    const yahooSymbol = toYahooSymbol(symbol, assetType);
    const url = new URL(`${YAHOO_BASE}/${encodeURIComponent(yahooSymbol)}`);
    url.searchParams.set("period1", String(Math.floor(range.from.getTime() / 1000)));
    url.searchParams.set("period2", String(Math.floor(range.to.getTime() / 1000)));
    url.searchParams.set("interval", "1d");

    const res = await safeFetch(url);
    if (!res) return null;
    const data = (await res.json().catch(() => null)) as YahooChartResponse | null;
    const result = data?.chart?.result?.[0];
    const timestamps = result?.timestamp;
    const quote = result?.indicators?.quote?.[0];
    if (!timestamps?.length || !quote?.close) return null;

    // A bar dated today (UTC) is a session in progress, not a close — its
    // OHLC keeps changing until the market shuts, so it would render as a
    // candle that visibly redraws itself on every refresh. Drop it, same
    // rule the /predict pipeline uses for this same endpoint.
    const todayStartSec = Math.floor(Date.now() / DAY_MS) * (DAY_MS / 1000);

    const candles: Candle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const t = timestamps[i]!;
      if (t >= todayStartSec) continue;
      const o = quote.open?.[i];
      const h = quote.high?.[i];
      const l = quote.low?.[i];
      const c = quote.close?.[i];
      if (o == null || h == null || l == null || c == null) continue;
      candles.push({ time: t, open: o, high: h, low: l, close: c });
    }
    return candles.length > 0 ? candles : null;
  },

  // Date of the earliest bar Yahoo has for this symbol — used to cap the
  // Playground date pickers so a user can't pick a date `getCandles` (above)
  // has no data for. Deliberately mirrors `getCandles`'s exact request shape
  // (explicit period1/period2, not `range=max`) so the two agree: Yahoo's
  // `range=max` silently under-reports depth relative to an explicit
  // `period1=0` (epoch) for the same symbol — verified against AAPL, whose
  // real 1980 IPO this endpoint doesn't reach either way, but `range=max`
  // additionally truncated to 1984 where `period1=0` correctly reaches 1985.
  // `interval=1mo` keeps the payload small; we only need the first timestamp.
  async getEarliestDate(symbol: string, assetType: AssetType): Promise<string | null> {
    const yahooSymbol = toYahooSymbol(symbol, assetType);
    const url = new URL(`${YAHOO_BASE}/${encodeURIComponent(yahooSymbol)}`);
    url.searchParams.set("period1", "0");
    url.searchParams.set("period2", String(Math.floor(Date.now() / 1000)));
    url.searchParams.set("interval", "1mo");

    const res = await safeFetch(url);
    if (!res) return null;
    const data = (await res.json().catch(() => null)) as YahooChartResponse | null;
    const timestamps = data?.chart?.result?.[0]?.timestamp;
    if (!timestamps?.length) return null;
    return new Date(timestamps[0]! * 1000).toISOString().slice(0, 10);
  },
};
