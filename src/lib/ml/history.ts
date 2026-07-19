// Daily close history for the /predict feature. Server-side only.
//
// The chart feature (`marketdata/candles.ts`) can live with 4-day CoinGecko
// buckets and missing stock candles; the model cannot — it was trained on
// one-bar-per-day closes. So this module has its own sources:
//
//   CRYPTO       CoinGecko /market_chart?interval=daily (keyless; coin id
//                comes from AssetSymbol.exchange, same as the quote path).
//   STOCK/FOREX  Yahoo v8 chart endpoint (keyless JSON) — the exact same
//                endpoint ml/train.py trained the stock panel from.
//
// Conventions pinned by the trainer (see docs/ml-prediction.md):
//  - A bar dated today (UTC) is a session in progress, not a close — drop it.
//  - CoinGecko's midnight point at 00:00 of day D is the close OF day D-1;
//    non-midnight trailing points are "right now" samples — dropped.

import type { AssetSymbol } from "@prisma/client";
import type { DailyBar } from "./features";

const TIMEOUT_MS = 8000;
const DAY_MS = 24 * 60 * 60 * 1000;

function utcDateString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function todayUtc(): string {
  return utcDateString(Date.now());
}

async function safeJson(url: string, headers: Record<string, string>): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

interface CgMarketChart {
  prices?: Array<[number, number]>;
  total_volumes?: Array<[number, number]>;
}

async function fetchCoingeckoDaily(coinId: string): Promise<DailyBar[] | null> {
  const headers: Record<string, string> = { accept: "application/json" };
  const key = process.env.COINGECKO_DEMO_API_KEY?.trim();
  if (key) headers["x-cg-demo-api-key"] = key;
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(
    coinId,
  )}/market_chart?vs_currency=usd&days=365&interval=daily`;
  const data = (await safeJson(url, headers)) as CgMarketChart | null;
  if (!data?.prices?.length) return null;

  const volumeByTs = new Map<number, number>(data.total_volumes ?? []);
  const bars: DailyBar[] = [];
  for (const [ts, price] of data.prices) {
    // Trailing "right now" sample — not a daily close.
    if (ts % DAY_MS !== 0) continue;
    if (!Number.isFinite(price) || price <= 0) continue;
    const volume = volumeByTs.get(ts);
    bars.push({
      // The 00:00 UTC point of day D is the close of day D-1.
      date: utcDateString(ts - DAY_MS),
      close: price,
      volume: volume && Number.isFinite(volume) && volume > 0 ? volume : null,
    });
  }
  return bars.length > 0 ? bars : null;
}

interface YahooChart {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{ close?: Array<number | null>; volume?: Array<number | null> }>;
      };
    }>;
  };
}

async function fetchYahooDaily(yahooSymbol: string): Promise<DailyBar[] | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol,
  )}?range=1y&interval=1d`;
  const data = (await safeJson(url, {
    "user-agent": "Mozilla/5.0 (tradelog)",
  })) as YahooChart | null;
  const result = data?.chart?.result?.[0];
  const timestamps = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];
  if (!timestamps?.length || !quote?.close) return null;

  const today = todayUtc();
  const bars: DailyBar[] = [];
  let lastDate = "";
  for (let i = 0; i < timestamps.length; i++) {
    const close = quote.close[i];
    if (close === null || close === undefined || !Number.isFinite(close) || close <= 0) continue;
    const date = utcDateString(timestamps[i] * 1000);
    if (date >= today) continue; // session in progress
    if (date === lastDate) continue; // defensive dedupe
    lastDate = date;
    const volume = quote.volume?.[i];
    bars.push({
      date,
      close,
      volume: volume && Number.isFinite(volume) && volume > 0 ? volume : null,
    });
  }
  return bars.length > 0 ? bars : null;
}

/** "EUR/USD" or "OANDA:EUR_USD"-style symbols → Yahoo's "EURUSD=X". */
function yahooForexSymbol(symbol: string): string {
  const letters = symbol.replace(/[^A-Za-z]/g, "").toUpperCase();
  return `${letters}=X`;
}

/**
 * Daily closes (oldest → newest) for the prediction model, or null when the
 * venue has nothing for this symbol. Callers turn null into the usual
 * graceful "historical data unavailable" message.
 */
export async function fetchDailyHistory(symbol: AssetSymbol): Promise<DailyBar[] | null> {
  if (symbol.assetType === "CRYPTO") {
    if (!symbol.exchange) return null; // no CoinGecko id — can't resolve
    return fetchCoingeckoDaily(symbol.exchange);
  }
  if (symbol.assetType === "FOREX") {
    return fetchYahooDaily(yahooForexSymbol(symbol.symbol));
  }
  return fetchYahooDaily(symbol.symbol);
}
