// Feature engineering for the /predict model — the TypeScript half of the
// parity contract with ml/train.py. Every indicator uses PLAIN LOOPS and a
// FINITE lookback (max 50 bars) so the value depends only on the last 50
// candles, never on how much history happened to be fetched. That is what
// makes training-time (Python) and inference-time (here) numbers identical.
//
// If you change a formula here, change ml/train.py to match and re-run the
// trainer — tests/unit/ml-features.test.ts pins both sides to golden
// vectors generated from the same candles.

export interface DailyBar {
  /** UTC trading date, `yyyy-mm-dd`. */
  date: string;
  close: number;
  /** Null when the venue reports no volume (e.g. forex). */
  volume: number | null;
}

/** Ordered exactly like ml/train.py's FEATURES — verified against meta.json at load. */
export const FEATURE_NAMES = [
  "logret_1",
  "logret_2",
  "logret_3",
  "logret_5",
  "logret_10",
  "sma_ratio_7_21",
  "sma_ratio_21_50",
  "close_over_sma50",
  "rsi_14",
  "macd_hist_norm",
  "vol_7",
  "vol_21",
  "vol_ratio_7_21",
  "dist_max_20",
  "dist_min_20",
  "volume_z20",
  "dow_sin",
  "dow_cos",
  "is_crypto",
] as const;

/** Bars needed before the first feature row (50-bar SMA window). */
export const MIN_BARS = 50;

function sma(closes: number[], i: number, n: number): number {
  let sum = 0;
  for (let j = i - n + 1; j <= i; j++) sum += closes[j];
  return sum / n;
}

/** Population standard deviation (ddof = 0), like the trainer. */
function stdP(vals: number[]): number {
  let mean = 0;
  for (const v of vals) mean += v;
  mean /= vals.length;
  let acc = 0;
  for (const v of vals) acc += (v - mean) ** 2;
  return Math.sqrt(acc / vals.length);
}

// Cutler's RSI: simple sums of gains/losses over the window instead of
// Wilder's recursive smoothing, whose value depends on the entire series.
function cutlerRsi(closes: number[], i: number, n = 14): number {
  let gains = 0;
  let losses = 0;
  for (let j = i - n + 1; j <= i; j++) {
    const d = closes[j] - closes[j - 1];
    if (d > 0) gains += d;
    else losses -= d;
  }
  if (gains === 0 && losses === 0) return 50;
  if (losses === 0) return 100;
  if (gains === 0) return 0;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

/** Day of week with Monday = 0, matching Python's `date.weekday()`. */
function mondayDow(date: string): number {
  const utcDay = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return (utcDay + 6) % 7;
}

/**
 * Feature vector for bar `i` (needs i ≥ MIN_BARS - 1). NaN marks a missing
 * value — the XGBoost evaluator routes it to the tree's `missing` branch.
 */
export function computeFeaturesAt(bars: DailyBar[], i: number, isCrypto: boolean): number[] {
  const closes = bars.map((b) => b.close);
  const c = closes[i];
  const logret = (k: number) => Math.log(c / closes[i - k]);

  const sma7 = sma(closes, i, 7);
  const sma21 = sma(closes, i, 21);
  const sma50 = sma(closes, i, 50);

  // SMA-based MACD proxy — see trainer for why not true EMA-MACD.
  const mHist: number[] = [];
  for (let j = i - 8; j <= i; j++) mHist.push(sma(closes, j, 12) - sma(closes, j, 26));
  let signal = 0;
  for (const m of mHist) signal += m;
  signal /= 9;
  const macdHistNorm = (mHist[mHist.length - 1] - signal) / c;

  const rets21: number[] = [];
  for (let j = i - 20; j <= i; j++) rets21.push(Math.log(closes[j] / closes[j - 1]));
  const vol7 = stdP(rets21.slice(-7));
  const vol21 = stdP(rets21);
  const volRatio = vol21 > 0 ? vol7 / vol21 - 1 : 0;

  const win20 = closes.slice(i - 19, i + 1);
  const distMax20 = c / Math.max(...win20) - 1;
  const distMin20 = c / Math.min(...win20) - 1;

  let volumeZ20 = NaN;
  const vwin: number[] = [];
  let vwinOk = true;
  for (let j = i - 19; j <= i; j++) {
    const v = bars[j].volume;
    if (v === null || !Number.isFinite(v) || v <= 0) {
      vwinOk = false;
      break;
    }
    vwin.push(v);
  }
  if (vwinOk) {
    const vstd = stdP(vwin);
    if (vstd > 0) {
      let vmean = 0;
      for (const v of vwin) vmean += v;
      vmean /= 20;
      volumeZ20 = (vwin[vwin.length - 1] - vmean) / vstd;
    }
  }

  const dow = mondayDow(bars[i].date);
  const dowSin = Math.sin((2 * Math.PI * dow) / 7);
  const dowCos = Math.cos((2 * Math.PI * dow) / 7);

  return [
    logret(1),
    logret(2),
    logret(3),
    logret(5),
    logret(10),
    sma7 / sma21 - 1,
    sma21 / sma50 - 1,
    c / sma50 - 1,
    cutlerRsi(closes, i),
    macdHistNorm,
    vol7,
    vol21,
    volRatio,
    distMax20,
    distMin20,
    volumeZ20,
    dowSin,
    dowCos,
    isCrypto ? 1 : 0,
  ];
}

/**
 * Feature vector for the most recent bar, or null when there isn't enough
 * history (fewer than MIN_BARS bars).
 */
export function computeLatestFeatures(bars: DailyBar[], isCrypto: boolean): number[] | null {
  if (bars.length < MIN_BARS) return null;
  return computeFeaturesAt(bars, bars.length - 1, isCrypto);
}

/** Zip the ordered vector into the name-keyed record the evaluator wants. */
export function featuresToRecord(vector: number[]): Record<string, number> {
  const record: Record<string, number> = {};
  FEATURE_NAMES.forEach((name, idx) => {
    record[name] = vector[idx];
  });
  return record;
}
