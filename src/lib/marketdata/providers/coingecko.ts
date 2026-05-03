import type { AssetType } from "@prisma/client";
import type { Quote, SymbolSearchResult } from "../client";
import type { Candle } from "../candles";

const CG_BASE = "https://api.coingecko.com/api/v3";
const TIMEOUT_MS = 5000;

function headers(): HeadersInit {
  const h: Record<string, string> = { accept: "application/json" };
  const k = process.env.COINGECKO_DEMO_API_KEY?.trim();
  if (k) h["x-cg-demo-api-key"] = k;
  return h;
}

interface CgSearchCoin {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number | null;
}

async function safeFetch(url: URL): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: headers(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

export const coingeckoProvider = {
  async searchSymbols(query: string): Promise<SymbolSearchResult[]> {
    const url = new URL(`${CG_BASE}/search`);
    url.searchParams.set("query", query);
    const res = await safeFetch(url);
    if (!res) return [];
    const data = (await res.json().catch(() => null)) as
      | { coins?: CgSearchCoin[] }
      | null;
    if (!data?.coins) return [];
    return data.coins.slice(0, 10).map((c) => ({
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      assetType: "CRYPTO" as AssetType,
      // CoinGecko's coin id ("bitcoin") is what /simple/price needs. The
      // autocomplete UI hides this slot for crypto so users don't see it.
      exchange: c.id,
      sector: null,
    }));
  },

  async getQuote(coinId: string): Promise<Quote | null> {
    const url = new URL(`${CG_BASE}/simple/price`);
    url.searchParams.set("ids", coinId);
    url.searchParams.set("vs_currencies", "usd");
    url.searchParams.set("include_24hr_change", "true");
    const res = await safeFetch(url);
    if (!res) return null;
    const data = (await res.json().catch(() => null)) as
      | Record<string, { usd?: number; usd_24h_change?: number }>
      | null;
    const entry = data?.[coinId];
    if (!entry?.usd) return null;
    return { price: entry.usd, changePct: entry.usd_24h_change ?? null };
  },

  // OHLC candles for a coin. CoinGecko's /ohlc endpoint accepts a discrete
  // `days` ladder only — we snap the requested range up to the next allowed
  // bucket and then trim to the requested window client-side.
  async getCandles(
    coinId: string,
    range: { from: Date; to: Date },
  ): Promise<Candle[] | null> {
    const days = msToCgDays(Date.now() - range.from.getTime());
    const url = new URL(`${CG_BASE}/coins/${coinId}/ohlc`);
    url.searchParams.set("vs_currency", "usd");
    url.searchParams.set("days", String(days));
    const res = await safeFetch(url);
    if (!res) return null;
    const data = (await res.json().catch(() => null)) as
      | Array<[number, number, number, number, number]>
      | null;
    if (!Array.isArray(data) || data.length === 0) return null;
    const fromMs = range.from.getTime();
    const toMs = range.to.getTime();
    const candles: Candle[] = [];
    for (const row of data) {
      const [tMs, o, h, l, c] = row;
      if (tMs < fromMs || tMs > toMs) continue;
      candles.push({ time: Math.floor(tMs / 1000), open: o, high: h, low: l, close: c });
    }
    return candles.length > 0 ? candles : null;
  },
};

// CoinGecko's /ohlc only accepts these specific `days` values.
function msToCgDays(ms: number): number | "max" {
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  for (const d of [1, 7, 14, 30, 90, 180, 365]) if (days <= d) return d;
  return "max";
}
