import type { AssetType } from "@prisma/client";
import type { Quote, SymbolSearchResult } from "../client";
import type { Candle } from "../candles";

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const TIMEOUT_MS = 5000;

function apiKey(): string | null {
  return process.env.FINNHUB_API_KEY?.trim() || null;
}

interface FinnhubSearchHit {
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
}

interface FinnhubQuote {
  c: number;
  d: number | null;
  dp: number | null;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

function classifyType(t: string): AssetType | null {
  const upper = t.toUpperCase();
  if (upper.includes("FOREX")) return "FOREX";
  if (upper.includes("STOCK") || upper.includes("ETF") || upper.includes("ADR"))
    return "STOCK";
  return null;
}

async function safeFetch(url: URL): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

export const finnhubProvider = {
  async searchSymbols(
    query: string,
    assetType?: AssetType,
  ): Promise<SymbolSearchResult[]> {
    const k = apiKey();
    if (!k) return [];
    const url = new URL(`${FINNHUB_BASE}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("token", k);
    const res = await safeFetch(url);
    if (!res) return [];
    const data = (await res.json().catch(() => null)) as
      | { result?: FinnhubSearchHit[] }
      | null;
    if (!data?.result) return [];
    const hits: SymbolSearchResult[] = [];
    for (const r of data.result) {
      const type = classifyType(r.type);
      if (!type) continue;
      if (assetType && type !== assetType) continue;
      hits.push({
        symbol: r.displaySymbol || r.symbol,
        name: r.description,
        assetType: type,
        // Forex needs the fully-qualified symbol (e.g. OANDA:EUR_USD) to
        // quote against later. Stocks use the bare ticker.
        exchange: type === "FOREX" ? r.symbol : null,
        sector: null,
      });
      if (hits.length >= 10) break;
    }
    return hits;
  },

  // Free-tier company profile. We only care about industry so the sector
  // heatmap can bucket holdings. Returns null on any failure (no key, 403,
  // network) — callers must handle that gracefully.
  async getIndustry(providerSymbol: string): Promise<string | null> {
    const k = apiKey();
    if (!k) return null;
    const url = new URL(`${FINNHUB_BASE}/stock/profile2`);
    url.searchParams.set("symbol", providerSymbol);
    url.searchParams.set("token", k);
    const res = await safeFetch(url);
    if (!res) return null;
    const data = (await res.json().catch(() => null)) as
      | { finnhubIndustry?: string }
      | null;
    const industry = data?.finnhubIndustry?.trim();
    return industry && industry.length > 0 ? industry : null;
  },

  // Annualised indicated dividend yield (e.g. 0.012 = 1.2%). Free tier
  // exposes `/stock/metric?metric=all`, which returns dozens of fields — we
  // only consume `dividendYieldIndicatedAnnual`. Provider returns it as a
  // **percent** (e.g. 1.2), so we divide by 100 to get a decimal.
  async getDividendYield(providerSymbol: string): Promise<number | null> {
    const k = apiKey();
    if (!k) return null;
    const url = new URL(`${FINNHUB_BASE}/stock/metric`);
    url.searchParams.set("symbol", providerSymbol);
    url.searchParams.set("metric", "all");
    url.searchParams.set("token", k);
    const res = await safeFetch(url);
    if (!res) return null;
    const data = (await res.json().catch(() => null)) as
      | { metric?: { dividendYieldIndicatedAnnual?: number | null } }
      | null;
    const pct = data?.metric?.dividendYieldIndicatedAnnual;
    if (pct == null || !Number.isFinite(pct) || pct <= 0) return null;
    return pct / 100;
  },

  async getQuote(providerSymbol: string): Promise<Quote | null> {
    const k = apiKey();
    if (!k) return null;
    const url = new URL(`${FINNHUB_BASE}/quote`);
    url.searchParams.set("symbol", providerSymbol);
    url.searchParams.set("token", k);
    const res = await safeFetch(url);
    if (!res) return null;
    const data = (await res.json().catch(() => null)) as FinnhubQuote | null;
    // Finnhub returns `c: 0` for unknown symbols rather than a 404.
    if (!data || !data.c) return null;
    return { price: data.c, changePct: data.dp ?? null };
  },

  // Daily OHLC candles for a stock or forex pair.
  // Note: `/stock/candle` and `/forex/candle` are gated to Finnhub paid tiers.
  // On free tier this returns null and the UI falls back to "Historical chart unavailable".
  async getCandles(
    providerSymbol: string,
    assetType: AssetType,
    range: { from: Date; to: Date },
  ): Promise<Candle[] | null> {
    const k = apiKey();
    if (!k) return null;
    const path = assetType === "FOREX" ? "/forex/candle" : "/stock/candle";
    const url = new URL(`${FINNHUB_BASE}${path}`);
    url.searchParams.set("symbol", providerSymbol);
    url.searchParams.set("resolution", "D");
    url.searchParams.set("from", String(Math.floor(range.from.getTime() / 1000)));
    url.searchParams.set("to", String(Math.floor(range.to.getTime() / 1000)));
    url.searchParams.set("token", k);
    const res = await safeFetch(url);
    if (!res) return null;
    const data = (await res.json().catch(() => null)) as
      | { c?: number[]; h?: number[]; l?: number[]; o?: number[]; t?: number[]; s?: string }
      | null;
    if (!data || data.s !== "ok" || !data.t?.length) return null;
    const candles: Candle[] = [];
    for (let i = 0; i < data.t.length; i++) {
      const o = data.o?.[i], h = data.h?.[i], l = data.l?.[i], c = data.c?.[i];
      if (o == null || h == null || l == null || c == null) continue;
      candles.push({ time: data.t[i]!, open: o, high: h, low: l, close: c });
    }
    return candles.length > 0 ? candles : null;
  },
};
