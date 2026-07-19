// Pure helpers for the Prediction row lifecycle: when a prediction becomes
// resolvable, which direction a probability implies, and how a resolved
// price scores it. Kept free of Prisma/network so the unit suite can pin
// the rules (tests/unit/ml-lifecycle.test.ts).

import type { PredictionDirection, PredictionHorizon, PredictionOutcome } from "@prisma/client";

// UI copy says "next day" / "next week". The model's label is bar-based
// (1 or 5 daily bars ahead); calendar time is the closest honest mapping —
// see docs/ml-prediction.md for the approximation notes.
export const HORIZON_MS: Record<PredictionHorizon, number> = {
  D1: 24 * 60 * 60 * 1000,
  W1: 7 * 24 * 60 * 60 * 1000,
};

export const HORIZON_LABEL: Record<PredictionHorizon, string> = {
  D1: "Next day",
  W1: "Next week",
};

export function resolveTime(createdAt: Date, horizon: PredictionHorizon): Date {
  return new Date(createdAt.getTime() + HORIZON_MS[horizon]);
}

/** p(up) ≥ 0.5 reads as UP — a coin-flip 0.5 shows as UP with 50% confidence. */
export function decideDirection(pUp: number): PredictionDirection {
  return pUp >= 0.5 ? "UP" : "DOWN";
}

/** Confidence in the *predicted* direction, in [0.5, 1]. */
export function confidence(pUp: number): number {
  return Math.max(pUp, 1 - pUp);
}

/**
 * Score a resolved prediction. An exactly-flat price counts as MISS for
 * both directions — the model claimed a move that didn't happen.
 */
export function decideOutcome(
  direction: PredictionDirection,
  priceAt: number,
  resolvedPrice: number,
): PredictionOutcome {
  if (direction === "UP") return resolvedPrice > priceAt ? "HIT" : "MISS";
  return resolvedPrice < priceAt ? "HIT" : "MISS";
}

/** UTC calendar-day key, used to dedupe same-day predictions per symbol. */
export function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Start of the UTC day containing `d` — dedupe window lower bound. */
export function utcDayStart(d: Date): Date {
  return new Date(`${utcDayKey(d)}T00:00:00.000Z`);
}
