import { describe, it, expect } from "vitest";
import {
  computeLatestFeatures,
  computeFeaturesAt,
  FEATURE_NAMES,
  MIN_BARS,
  type DailyBar,
} from "@/lib/ml/features";
import goldens from "./fixtures/ml-goldens.json";

// The parity contract: these vectors were computed by ml/train.py from the
// same candles. Any drift between the Python and TypeScript feature code
// fails here before it can silently skew predictions.

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
  return c.dates.map((date, i) => ({
    date,
    close: c.closes[i],
    volume: c.volumes[i],
  }));
}

describe("ml feature parity with ml/train.py goldens", () => {
  it("fixture matches the feature order the code was built for", () => {
    expect(goldens.featureNames).toEqual([...FEATURE_NAMES]);
  });

  for (const c of cases) {
    it(`reproduces the ${c.name} feature vector`, () => {
      const vector = computeLatestFeatures(toBars(c), c.isCrypto);
      expect(vector).not.toBeNull();
      expect(vector).toHaveLength(FEATURE_NAMES.length);
      c.expected.features.forEach((expected, i) => {
        const actual = vector![i];
        if (expected === null) {
          expect(Number.isNaN(actual), `${FEATURE_NAMES[i]} should be NaN`).toBe(true);
        } else {
          expect(actual, FEATURE_NAMES[i]).toBeCloseTo(expected, 9);
        }
      });
    });
  }
});

describe("ml feature edge cases", () => {
  function flatBars(n: number, close = 100, volume: number | null = 1000): DailyBar[] {
    // Weekday cycling dates starting on a known Monday.
    const start = new Date("2026-01-05T00:00:00Z").getTime();
    return Array.from({ length: n }, (_, i) => ({
      date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
      close,
      volume,
    }));
  }

  it("returns null with fewer than MIN_BARS bars", () => {
    expect(computeLatestFeatures(flatBars(MIN_BARS - 1), false)).toBeNull();
  });

  it("computes exactly at MIN_BARS bars", () => {
    expect(computeLatestFeatures(flatBars(MIN_BARS), false)).not.toBeNull();
  });

  it("a perfectly flat series yields neutral indicators", () => {
    const v = computeLatestFeatures(flatBars(60), false)!;
    const f = Object.fromEntries(FEATURE_NAMES.map((n, i) => [n, v[i]]));
    expect(f.logret_1).toBe(0);
    expect(f.logret_10).toBe(0);
    expect(f.sma_ratio_7_21).toBe(0);
    expect(f.close_over_sma50).toBe(0);
    expect(f.rsi_14).toBe(50); // no gains, no losses
    expect(f.macd_hist_norm).toBe(0);
    expect(f.vol_7).toBe(0);
    expect(f.vol_ratio_7_21).toBe(0); // guarded div-by-zero
    expect(f.dist_max_20).toBe(0);
    expect(f.dist_min_20).toBe(0);
    // Constant volume -> zero std -> missing, not zero.
    expect(Number.isNaN(f.volume_z20)).toBe(true);
  });

  it("monotonic gains pin RSI to 100, losses to 0", () => {
    const up = flatBars(60).map((b, i) => ({ ...b, close: 100 + i }));
    const down = flatBars(60).map((b, i) => ({ ...b, close: 200 - i }));
    const rsiIdx = FEATURE_NAMES.indexOf("rsi_14");
    expect(computeLatestFeatures(up, false)![rsiIdx]).toBe(100);
    expect(computeLatestFeatures(down, false)![rsiIdx]).toBe(0);
  });

  it("any missing volume in the 20-bar window marks volume_z20 as NaN", () => {
    const bars = flatBars(60).map((b, i) => ({ ...b, close: 100 + Math.sin(i) }));
    bars[55].volume = null; // inside the last-20 window
    const idx = FEATURE_NAMES.indexOf("volume_z20");
    expect(Number.isNaN(computeLatestFeatures(bars, false)![idx])).toBe(true);
  });

  it("volume-less venues (forex) get NaN volume_z20 but real price features", () => {
    const bars = flatBars(60, 100, null).map((b, i) => ({ ...b, close: 100 + Math.sin(i) }));
    const v = computeLatestFeatures(bars, false)!;
    expect(Number.isNaN(v[FEATURE_NAMES.indexOf("volume_z20")])).toBe(true);
    expect(Number.isFinite(v[FEATURE_NAMES.indexOf("rsi_14")])).toBe(true);
  });

  it("is_crypto flag lands in the vector", () => {
    const idx = FEATURE_NAMES.indexOf("is_crypto");
    expect(computeLatestFeatures(flatBars(60), true)![idx]).toBe(1);
    expect(computeLatestFeatures(flatBars(60), false)![idx]).toBe(0);
  });

  it("day-of-week uses the Monday=0 convention via sin/cos", () => {
    // flatBars starts Monday 2026-01-05; index 59 is 2026-03-05, a Thursday
    // (dow=3). sin(2π·3/7) ≈ 0.4339, cos ≈ -0.9009.
    const v = computeFeaturesAt(flatBars(60), 59, false);
    expect(v[FEATURE_NAMES.indexOf("dow_sin")]).toBeCloseTo(Math.sin((2 * Math.PI * 3) / 7), 12);
    expect(v[FEATURE_NAMES.indexOf("dow_cos")]).toBeCloseTo(Math.cos((2 * Math.PI * 3) / 7), 12);
  });
});
