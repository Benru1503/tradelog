"use server";

import { revalidatePath } from "next/cache";
import type { AssetType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { whatIfFormSchema, dcaFormSchema } from "@/lib/validators";
import { getCandles, type Candle } from "@/lib/marketdata/candles";
import {
  simulateWhatIf,
  simulateDca,
  type WhatIfResult,
  type DcaResult,
  type DcaCadence,
} from "@/lib/playground";
import { getMarketDataProvider } from "@/lib/marketdata/client";

const DAY_MS = 24 * 60 * 60 * 1000;

// Resolve a ticker the user typed/picked into an AssetSymbol row. The
// autocomplete usually pre-populates the row via /api/tickers/search, but a
// user could also type a ticker manually (Enter on free-text), in which
// case we run a fresh provider lookup and upsert the result.
async function resolveSymbol(asset: string, assetType: AssetType) {
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

export interface WhatIfParams {
  asset: string;
  assetType: AssetType;
  buyAmount: string;
  buyDate: string; // ISO date (yyyy-mm-dd)
  sellDate: string | null;
}

export type WhatIfResponse =
  | {
      ok: true;
      params: WhatIfParams;
      result: WhatIfResult;
      candles: Candle[];
      assetName: string;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function runWhatIf(formData: FormData): Promise<WhatIfResponse> {
  await requireUser();
  const raw = {
    asset: String(formData.get("asset") ?? ""),
    assetType: String(formData.get("assetType") ?? ""),
    buyAmount: String(formData.get("buyAmount") ?? ""),
    buyDate: String(formData.get("buyDate") ?? ""),
    sellDate: String(formData.get("sellDate") ?? ""),
  };
  const parsed = whatIfFormSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const symbol = await resolveSymbol(parsed.data.asset, parsed.data.assetType);
  if (!symbol) {
    return {
      ok: false,
      error: `Couldn't resolve ${parsed.data.asset}. Try the autocomplete to pick an exact match.`,
    };
  }

  const buyDate = new Date(parsed.data.buyDate);
  const sellDate = parsed.data.sellDate ? new Date(parsed.data.sellDate) : new Date();
  if (buyDate.getTime() > Date.now()) {
    return { ok: false, error: "Buy date can't be in the future." };
  }

  // Pad the range a couple of days each side so weekend picks still snap to
  // a real bar. `getCandles` reads only assetType/exchange/symbol off the row.
  const candles = await getCandles(symbol, {
    from: new Date(buyDate.getTime() - 2 * DAY_MS),
    to: new Date(sellDate.getTime() + 2 * DAY_MS),
  });
  if (!candles || candles.length === 0) {
    const tip =
      parsed.data.assetType === "STOCK" || parsed.data.assetType === "FOREX"
        ? "Finnhub's free tier doesn't expose historical candles for stocks/forex. Try a crypto ticker."
        : "Provider didn't return any history for this range.";
    return { ok: false, error: `Historical data unavailable. ${tip}` };
  }

  const result = simulateWhatIf(candles, {
    buyAmount: parsed.data.buyAmount,
    buyDate,
    sellDate: parsed.data.sellDate ? sellDate : null,
  });
  if (!result) {
    return { ok: false, error: "Couldn't compute a result for those dates." };
  }

  return {
    ok: true,
    params: {
      asset: symbol.symbol,
      assetType: symbol.assetType,
      buyAmount: parsed.data.buyAmount,
      buyDate: parsed.data.buyDate,
      sellDate: parsed.data.sellDate ? parsed.data.sellDate : null,
    },
    result,
    candles,
    assetName: symbol.name,
  };
}

export type SnapshotResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveWhatIfSnapshot(
  params: WhatIfParams,
  result: WhatIfResult,
  assetName: string,
): Promise<SnapshotResult> {
  const user = await requireUser();
  await prisma.simSnapshot.create({
    data: {
      userId: user.id,
      kind: "WHAT_IF",
      params: { ...params, assetName } as Prisma.InputJsonValue,
      result: { ...result } as Prisma.InputJsonValue,
    },
  });
  revalidatePath("/playground");
  return { ok: true };
}

export interface DcaParams {
  asset: string;
  assetType: AssetType;
  amount: string;
  cadence: DcaCadence;
  from: string;
  to: string | null;
}

export type DcaResponse =
  | {
      ok: true;
      params: DcaParams;
      result: DcaResult;
      assetName: string;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function runDca(formData: FormData): Promise<DcaResponse> {
  await requireUser();
  const raw = {
    asset: String(formData.get("asset") ?? ""),
    assetType: String(formData.get("assetType") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    cadence: String(formData.get("cadence") ?? ""),
    from: String(formData.get("from") ?? ""),
    to: String(formData.get("to") ?? ""),
  };
  const parsed = dcaFormSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const symbol = await resolveSymbol(parsed.data.asset, parsed.data.assetType);
  if (!symbol) {
    return {
      ok: false,
      error: `Couldn't resolve ${parsed.data.asset}. Try the autocomplete to pick an exact match.`,
    };
  }

  const fromDate = new Date(parsed.data.from);
  const toDate = parsed.data.to ? new Date(parsed.data.to) : new Date();
  if (fromDate.getTime() > Date.now()) {
    return { ok: false, error: "Start date can't be in the future." };
  }

  const candles = await getCandles(symbol, {
    from: new Date(fromDate.getTime() - 2 * DAY_MS),
    to: new Date(toDate.getTime() + 2 * DAY_MS),
  });
  if (!candles || candles.length === 0) {
    const tip =
      parsed.data.assetType === "STOCK" || parsed.data.assetType === "FOREX"
        ? "Finnhub's free tier doesn't expose historical candles for stocks/forex. Try a crypto ticker."
        : "Provider didn't return any history for this range. CoinGecko's free tier caps daily history at ~1 year.";
    return { ok: false, error: `Historical data unavailable. ${tip}` };
  }

  const result = simulateDca(candles, {
    amount: parsed.data.amount,
    cadence: parsed.data.cadence,
    from: fromDate,
    to: parsed.data.to ? toDate : null,
  });
  if (!result) {
    return { ok: false, error: "Couldn't compute a result for that range." };
  }

  return {
    ok: true,
    params: {
      asset: symbol.symbol,
      assetType: symbol.assetType,
      amount: parsed.data.amount,
      cadence: parsed.data.cadence,
      from: parsed.data.from,
      to: parsed.data.to ? parsed.data.to : null,
    },
    result,
    assetName: symbol.name,
  };
}

export async function saveDcaSnapshot(
  params: DcaParams,
  result: DcaResult,
  assetName: string,
): Promise<SnapshotResult> {
  const user = await requireUser();
  // Strip the high-resolution series before persisting — it's reproducible
  // from the params + provider, and would bloat snapshot rows for long
  // ranges. Keep contributions and totals so the saved card is useful.
  const compactResult = {
    contributions: result.contributions,
    totalInvested: result.totalInvested,
    finalValue: result.finalValue,
    totalShares: result.totalShares,
    pnl: result.pnl,
    pnlPct: result.pnlPct,
    cagrPct: result.cagrPct,
    fromTime: result.fromTime,
    toTime: result.toTime,
  };
  await prisma.simSnapshot.create({
    data: {
      userId: user.id,
      kind: "DCA",
      params: { ...params, assetName } as Prisma.InputJsonValue,
      result: compactResult as unknown as Prisma.InputJsonValue,
    },
  });
  revalidatePath("/playground");
  return { ok: true };
}

export async function deleteSnapshot(id: string): Promise<SnapshotResult> {
  const user = await requireUser();
  const existing = await prisma.simSnapshot.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return { ok: false, error: "Snapshot not found." };
  }
  await prisma.simSnapshot.delete({ where: { id } });
  revalidatePath("/playground");
  return { ok: true };
}
