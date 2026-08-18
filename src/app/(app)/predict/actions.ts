"use server";

import { revalidatePath } from "next/cache";
import type { AssetType, PredictionDirection, PredictionHorizon } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { predictFormSchema } from "@/lib/validators";
import { resolveSymbol } from "@/lib/marketdata/resolve";
import { fetchDailyHistory } from "@/lib/ml/history";
import { computeLatestFeatures, MIN_BARS } from "@/lib/ml/features";
import { MODEL_META, predictPUp } from "@/lib/ml/model";
import { confidence, decideDirection, resolveTime, utcDayStart } from "@/lib/ml/lifecycle";
import { rateLimit } from "@/lib/rate-limit";

// A little margin over the hard MIN_BARS floor so one venue gap doesn't
// flip a symbol between "works" and "not enough history" day to day.
const REQUIRED_BARS = MIN_BARS + 10;

// Two layers, because they stop different things. The per-minute window stops
// a loop; the daily cap bounds how many distinct symbols one account can pull
// history for. Reruns of the same symbol/horizon dedupe to the existing row
// without a provider call, so they do not count against the daily figure.
const PREDICTIONS_PER_MINUTE = 10;
const PREDICTIONS_PER_DAY = 40;

export interface PredictionDto {
  id: string;
  symbol: string;
  assetName: string;
  assetType: AssetType;
  horizon: PredictionHorizon;
  direction: PredictionDirection;
  pUp: number;
  confidencePct: number;
  priceAt: number;
  candleDate: string;
  createdAt: string;
  resolvesAt: string;
  modelVersion: string;
  // True when today's identical prediction already existed and was returned
  // instead of creating a duplicate row.
  deduped: boolean;
}

export type PredictResponse =
  | { ok: true; prediction: PredictionDto }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function runPrediction(formData: FormData): Promise<PredictResponse> {
  const user = await requireUser();
  const raw = {
    asset: String(formData.get("asset") ?? ""),
    assetType: String(formData.get("assetType") ?? ""),
    horizon: String(formData.get("horizon") ?? ""),
  };
  const parsed = predictFormSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const burst = rateLimit(`predict:${user.id}`, PREDICTIONS_PER_MINUTE, 60_000);
  if (!burst.ok) {
    return { ok: false, error: "That's a lot of predictions at once — give it a minute." };
  }

  const madeToday = await prisma.prediction.count({
    where: { userId: user.id, createdAt: { gte: utcDayStart(new Date()) } },
  });
  if (madeToday >= PREDICTIONS_PER_DAY) {
    return {
      ok: false,
      error: `You've made ${madeToday} predictions today. The daily limit is ${PREDICTIONS_PER_DAY} — your existing calls still resolve as normal.`,
    };
  }

  const symbol = await resolveSymbol(parsed.data.asset, parsed.data.assetType);
  if (!symbol) {
    return {
      ok: false,
      error: `Couldn't resolve ${parsed.data.asset}. Try the autocomplete to pick an exact match.`,
    };
  }

  // One prediction per symbol/horizon per UTC day — rerunning the form
  // returns the existing row instead of spamming history.
  const existing = await prisma.prediction.findFirst({
    where: {
      userId: user.id,
      symbol: symbol.symbol,
      assetType: symbol.assetType,
      horizon: parsed.data.horizon,
      createdAt: { gte: utcDayStart(new Date()) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return {
      ok: true,
      prediction: {
        id: existing.id,
        symbol: existing.symbol,
        assetName: symbol.name,
        assetType: existing.assetType,
        horizon: existing.horizon,
        direction: existing.direction,
        pUp: Number(existing.pUp),
        confidencePct: confidence(Number(existing.pUp)) * 100,
        priceAt: Number(existing.priceAt),
        candleDate: existing.candleTime.toISOString().slice(0, 10),
        createdAt: existing.createdAt.toISOString(),
        resolvesAt: existing.resolvesAt.toISOString(),
        modelVersion: existing.modelVersion,
        deduped: true,
      },
    };
  }

  const bars = await fetchDailyHistory(symbol);
  if (!bars || bars.length === 0) {
    const tip =
      symbol.assetType === "CRYPTO"
        ? "CoinGecko didn't return daily history for this coin."
        : "The venue didn't return daily history for this symbol.";
    return { ok: false, error: `Historical data unavailable. ${tip}` };
  }
  if (bars.length < REQUIRED_BARS) {
    return {
      ok: false,
      error: `Not enough history for ${symbol.symbol} — the model needs ~${REQUIRED_BARS} daily closes, got ${bars.length}. Recently listed assets can't be scored.`,
    };
  }

  const features = computeLatestFeatures(bars, symbol.assetType === "CRYPTO");
  if (!features) {
    return { ok: false, error: "Couldn't compute features for this symbol." };
  }

  const pUp = predictPUp(features, parsed.data.horizon);
  const direction = decideDirection(pUp);
  const last = bars[bars.length - 1];
  const now = new Date();

  const row = await prisma.prediction.create({
    data: {
      userId: user.id,
      symbol: symbol.symbol,
      assetType: symbol.assetType,
      horizon: parsed.data.horizon,
      direction,
      pUp: pUp.toFixed(5),
      priceAt: last.close,
      candleTime: new Date(`${last.date}T00:00:00.000Z`),
      modelVersion: MODEL_META.version,
      resolvesAt: resolveTime(now, parsed.data.horizon),
    },
  });
  revalidatePath("/predict");

  return {
    ok: true,
    prediction: {
      id: row.id,
      symbol: row.symbol,
      assetName: symbol.name,
      assetType: row.assetType,
      horizon: row.horizon,
      direction: row.direction,
      pUp,
      confidencePct: confidence(pUp) * 100,
      priceAt: last.close,
      candleDate: last.date,
      createdAt: row.createdAt.toISOString(),
      resolvesAt: row.resolvesAt.toISOString(),
      modelVersion: row.modelVersion,
      deduped: false,
    },
  };
}

export type DeletePredictionResult = { ok: true } | { ok: false; error: string };

export async function deletePrediction(id: string): Promise<DeletePredictionResult> {
  const user = await requireUser();
  const existing = await prisma.prediction.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return { ok: false, error: "Prediction not found." };
  }
  await prisma.prediction.delete({ where: { id } });
  revalidatePath("/predict");
  return { ok: true };
}
