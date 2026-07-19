import { describe, it, expect } from "vitest";
import { evalMargin, evalTree, predictProbability, sigmoid, type XgbNode } from "@/lib/ml/xgboost";
import { computeLatestFeatures, featuresToRecord, type DailyBar } from "@/lib/ml/features";
import { MODEL_META, predictPUp } from "@/lib/ml/model";
import goldens from "./fixtures/ml-goldens.json";

interface GoldenCase {
  name: string;
  isCrypto: boolean;
  dates: string[];
  closes: number[];
  volumes: Array<number | null>;
  expected: {
    features: Array<number | null>;
    d1: { margin: number; pUp: number };
    w1: { margin: number; pUp: number };
  };
}

const cases = goldens.cases as GoldenCase[];

function toBars(c: GoldenCase): DailyBar[] {
  return c.dates.map((date, i) => ({ date, close: c.closes[i], volume: c.volumes[i] }));
}

describe("real-model golden parity (candles -> probability)", () => {
  it("meta.json loaded with both horizons", () => {
    expect(MODEL_META.version).toBeTruthy();
    expect(MODEL_META.horizons.d1.trees).toBeGreaterThan(0);
    expect(MODEL_META.horizons.w1.trees).toBeGreaterThan(0);
  });

  for (const c of cases) {
    it(`${c.name}: end-to-end probability matches the Python trainer`, () => {
      const vector = computeLatestFeatures(toBars(c), c.isCrypto)!;
      expect(predictPUp(vector, "D1")).toBeCloseTo(c.expected.d1.pUp, 8);
      expect(predictPUp(vector, "W1")).toBeCloseTo(c.expected.w1.pUp, 8);
    });
  }
});

describe("tree evaluator semantics", () => {
  // Hand-built stump: f0 < t ? leaf 1.0 : leaf -1.0, missing -> yes branch.
  const threshold = Math.fround(0.1); // 0.10000000149011612
  const stump: XgbNode = {
    nodeid: 0,
    split: "f0",
    split_condition: threshold,
    yes: 1,
    no: 2,
    missing: 1,
    children: [
      { nodeid: 1, leaf: 1.0 },
      { nodeid: 2, leaf: -1.0 },
    ],
  };

  it("routes below-threshold values to yes", () => {
    expect(evalTree(stump, { f0: 0.05 })).toBe(1.0);
  });

  it("routes at/above-threshold values to no", () => {
    expect(evalTree(stump, { f0: 0.2 })).toBe(-1.0);
  });

  it("compares in float32 like XGBoost (0.1 f64 is NOT below fround(0.1))", () => {
    // In float64, 0.1 < 0.10000000149011612 — a naive evaluator takes yes.
    // XGBoost casts to float32 first, where they are equal -> no branch.
    expect(0.1 < threshold).toBe(true); // the trap
    expect(evalTree(stump, { f0: 0.1 })).toBe(-1.0); // the correct behavior
  });

  it("routes NaN and absent features to the missing branch", () => {
    expect(evalTree(stump, { f0: NaN })).toBe(1.0);
    expect(evalTree(stump, {})).toBe(1.0);
  });

  it("sums margins across trees and applies sigmoid + intercept", () => {
    const trees = [stump, stump];
    expect(evalMargin(trees, { f0: 0.05 })).toBe(2.0);
    expect(predictProbability(trees, 0.5, { f0: 0.05 })).toBeCloseTo(sigmoid(2.5), 12);
  });

  it("throws on a malformed dump instead of guessing", () => {
    const broken = { nodeid: 0, split: "f0", split_condition: 1 } as XgbNode;
    expect(() => evalTree(broken, { f0: 0 })).toThrow(/malformed/);
  });
});

describe("featuresToRecord", () => {
  it("keys the vector by feature name in order", () => {
    const vector = Array.from({ length: 19 }, (_, i) => i);
    const record = featuresToRecord(vector);
    expect(record.logret_1).toBe(0);
    expect(record.is_crypto).toBe(18);
    expect(Object.keys(record)).toHaveLength(19);
  });
});
