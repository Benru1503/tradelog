// Loads the trained model artifacts (JSON tree dumps + metadata exported by
// ml/train.py) and exposes typed prediction + model-card accessors.
// Server-side only — the artifacts are bundled into the server build and
// must never ship to the browser.

import type { PredictionHorizon } from "@prisma/client";
import metaJson from "./artifacts/meta.json";
import modelD1Json from "./artifacts/model.d1.json";
import modelW1Json from "./artifacts/model.w1.json";
import { FEATURE_NAMES, featuresToRecord } from "./features";
import { predictProbability, type XgbNode } from "./xgboost";

export interface HorizonMeta {
  bars: number;
  intercept: number;
  trees: number;
  validAuc: number;
  testAuc: number;
  testAccuracy: number;
  testBaseRate: number;
  testRows: number;
  trainRows: number;
}

export interface BacktestEntry {
  asset: string;
  horizon: string;
  windowFrom: string;
  windowTo: string;
  strategyRetPct: number;
  buyHoldRetPct: number;
  hitRatePct: number | null;
  daysInMarketPct: number;
  trades: number;
  maxDrawdownPct: number;
  sharpe: number;
}

export interface ModelMeta {
  version: string;
  trainedAt: string;
  source: string;
  featureNames: string[];
  warmupBars: number;
  horizons: { d1: HorizonMeta; w1: HorizonMeta };
  dataInfo: { assets: string[]; from: string; validFrom: string; testFrom: string };
  backtest: { threshold: number; feeBps: number; perAsset: BacktestEntry[] };
}

export const MODEL_META = metaJson as ModelMeta;

const TREES: Record<"d1" | "w1", XgbNode[]> = {
  d1: (modelD1Json as { trees: unknown }).trees as XgbNode[],
  w1: (modelW1Json as { trees: unknown }).trees as XgbNode[],
};

// The artifact's feature order is the ground truth the trees were built
// against; FEATURE_NAMES is what computeFeatures produces. They must be the
// same list or every prediction is silently garbage — fail loudly instead.
if (
  MODEL_META.featureNames.length !== FEATURE_NAMES.length ||
  MODEL_META.featureNames.some((name, i) => name !== FEATURE_NAMES[i])
) {
  throw new Error(
    "ml artifacts out of sync: meta.json featureNames != features.ts FEATURE_NAMES — re-run ml/train.py",
  );
}

function horizonKey(horizon: PredictionHorizon): "d1" | "w1" {
  return horizon === "D1" ? "d1" : "w1";
}

/** Probability that the close is higher after the horizon. */
export function predictPUp(featureVector: number[], horizon: PredictionHorizon): number {
  const key = horizonKey(horizon);
  return predictProbability(
    TREES[key],
    MODEL_META.horizons[key].intercept,
    featuresToRecord(featureVector),
  );
}

export function horizonMeta(horizon: PredictionHorizon): HorizonMeta {
  return MODEL_META.horizons[horizonKey(horizon)];
}
