// Pure simulator math for the Playground page. Kept side-effect-free so
// it's straightforward to unit-test and runs identically server-side or in
// a hypothetical future client preview.
//
// The What-if scenario boils down to: given a candle series, an amount to
// invest at one date, and a date to value the result against, return the
// resulting share count, sale value, and P&L. Stocks/forex usually have no
// candles on Finnhub free tier — the action surfaces that as a friendly
// "historical data unavailable" rather than a crash.

import Decimal from "decimal.js";
import type { Candle } from "@/lib/marketdata/candles";

export interface WhatIfInput {
  buyAmount: string | number;
  buyDate: Date;
  // null → run the scenario through to "now" using the latest candle.
  sellDate: Date | null;
}

export interface WhatIfResult {
  buyTime: number;
  buyPrice: number;
  sellTime: number;
  sellPrice: number;
  shares: number;
  saleValue: number;
  pnl: number;
  pnlPct: number;
}

// Snap to the candle whose timestamp is closest to `target`. Used for both
// buy and sell date resolution — the user picks a calendar day; we pick
// whichever bar (daily OHLC) sits closest. Returns null on an empty series.
export function pickCandleAt(candles: Candle[], target: Date): Candle | null {
  if (candles.length === 0) return null;
  const targetSec = Math.floor(target.getTime() / 1000);
  let best = candles[0]!;
  let bestDelta = Math.abs(targetSec - best.time);
  for (let i = 1; i < candles.length; i++) {
    const d = Math.abs(targetSec - candles[i]!.time);
    if (d < bestDelta) {
      best = candles[i]!;
      bestDelta = d;
    }
  }
  return best;
}

// DCA — periodic equal-dollar contributions into a single asset. Each
// contribution buys at the close of the candle nearest its scheduled date.
// Returned `series` is one point per candle in range (cumulative invested vs
// portfolio value); `cagrPct` is the annualized money-weighted rate solved
// via XIRR over the contribution stream + final value.

export type DcaCadence = "WEEKLY" | "MONTHLY";

export interface DcaInput {
  amount: string | number;
  cadence: DcaCadence;
  from: Date;
  // null → run through to the latest candle in the series.
  to: Date | null;
}

export interface DcaContribution {
  time: number;
  price: number;
  shares: number;
  amount: number;
}

export interface DcaPoint {
  time: number;
  invested: number;
  value: number;
}

export interface DcaResult {
  contributions: DcaContribution[];
  series: DcaPoint[];
  totalInvested: number;
  finalValue: number;
  totalShares: number;
  pnl: number;
  pnlPct: number;
  // null if the range is too short or XIRR didn't converge.
  cagrPct: number | null;
  fromTime: number;
  toTime: number;
}

function advanceCadence(d: Date, cadence: DcaCadence): Date {
  const next = new Date(d);
  if (cadence === "WEEKLY") next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

function generateContributionDates(
  from: Date,
  to: Date,
  cadence: DcaCadence,
): Date[] {
  const out: Date[] = [];
  let cur = new Date(from);
  // Cap to defend against pathological ranges (~190 years weekly).
  for (let i = 0; i < 10000 && cur.getTime() <= to.getTime(); i++) {
    out.push(new Date(cur));
    cur = advanceCadence(cur, cadence);
  }
  return out;
}

// XIRR via bisection. Cash flows: contributions are negative (money out),
// final value is positive (money in). Returns annualized rate, or null if
// the cash-flow signs don't permit a solution.
export function xirr(
  cashflows: { time: number; amount: number }[],
): number | null {
  if (cashflows.length < 2) return null;
  const hasNeg = cashflows.some((c) => c.amount < 0);
  const hasPos = cashflows.some((c) => c.amount > 0);
  if (!hasNeg || !hasPos) return null;
  const t0 = cashflows[0]!.time;
  const npv = (r: number) =>
    cashflows.reduce(
      (s, cf) =>
        s + cf.amount / Math.pow(1 + r, (cf.time - t0) / (365.25 * 86400)),
      0,
    );
  let lo = -0.99;
  let hi = 10;
  let nLo = npv(lo);
  let nHi = npv(hi);
  if (Number.isNaN(nLo) || Number.isNaN(nHi)) return null;
  if (nLo * nHi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const nMid = npv(mid);
    if (Math.abs(nMid) < 1e-7) return mid;
    if (nLo * nMid < 0) {
      hi = mid;
      nHi = nMid;
    } else {
      lo = mid;
      nLo = nMid;
    }
  }
  return (lo + hi) / 2;
}

export function simulateDca(
  candles: Candle[],
  input: DcaInput,
): DcaResult | null {
  if (candles.length === 0) return null;
  const amount = new Decimal(input.amount);
  if (amount.lte(0)) return null;
  const sorted = [...candles].sort((a, b) => a.time - b.time);
  const fromTime = Math.floor(input.from.getTime() / 1000);
  const last = sorted[sorted.length - 1]!;
  const toTime = input.to ? Math.floor(input.to.getTime() / 1000) : last.time;
  if (toTime < fromTime) return null;

  const effectiveTo = new Date(Math.min(toTime, last.time) * 1000);
  const dates = generateContributionDates(input.from, effectiveTo, input.cadence);
  if (dates.length === 0) return null;

  const contributions: DcaContribution[] = [];
  let totalShares = new Decimal(0);
  let totalInvested = new Decimal(0);
  for (const d of dates) {
    const c = pickCandleAt(sorted, d);
    if (!c) continue;
    const price = new Decimal(c.close);
    if (price.lte(0)) continue;
    const shares = amount.div(price);
    totalShares = totalShares.plus(shares);
    totalInvested = totalInvested.plus(amount);
    contributions.push({
      time: c.time,
      price: price.toNumber(),
      shares: shares.toNumber(),
      amount: amount.toNumber(),
    });
  }
  if (contributions.length === 0) return null;

  // Per-candle series of cumulative invested vs market value. We walk the
  // contribution list in lockstep with the candle list to keep this O(n+m).
  const series: DcaPoint[] = [];
  let cIdx = 0;
  let runningShares = new Decimal(0);
  let runningInvested = new Decimal(0);
  for (const candle of sorted) {
    if (candle.time < contributions[0]!.time) continue;
    if (candle.time > toTime) break;
    while (cIdx < contributions.length && contributions[cIdx]!.time <= candle.time) {
      const ctr = contributions[cIdx]!;
      runningShares = runningShares.plus(ctr.shares);
      runningInvested = runningInvested.plus(ctr.amount);
      cIdx++;
    }
    series.push({
      time: candle.time,
      invested: runningInvested.toNumber(),
      value: runningShares.mul(candle.close).toNumber(),
    });
  }

  const finalCandle =
    sorted.find((c) => c.time === toTime) ??
    [...sorted].reverse().find((c) => c.time <= toTime) ??
    last;
  const finalValue = totalShares.mul(finalCandle.close);
  const pnl = finalValue.minus(totalInvested);
  const pnlPct = totalInvested.gt(0)
    ? pnl.div(totalInvested).mul(100)
    : new Decimal(0);

  const cashflows = [
    ...contributions.map((c) => ({ time: c.time, amount: -c.amount })),
    { time: finalCandle.time, amount: finalValue.toNumber() },
  ];
  const rate = xirr(cashflows);
  const cagrPct = rate == null ? null : rate * 100;

  return {
    contributions,
    series,
    totalInvested: totalInvested.toNumber(),
    finalValue: finalValue.toNumber(),
    totalShares: totalShares.toNumber(),
    pnl: pnl.toNumber(),
    pnlPct: pnlPct.toNumber(),
    cagrPct,
    fromTime: contributions[0]!.time,
    toTime: finalCandle.time,
  };
}

export function simulateWhatIf(
  candles: Candle[],
  input: WhatIfInput,
): WhatIfResult | null {
  if (candles.length === 0) return null;
  const sorted = [...candles].sort((a, b) => a.time - b.time);
  const buy = pickCandleAt(sorted, input.buyDate);
  // No sell date → value against the latest candle in the series.
  const sell = input.sellDate
    ? pickCandleAt(sorted, input.sellDate)
    : sorted[sorted.length - 1]!;
  if (!buy || !sell) return null;
  const amount = new Decimal(input.buyAmount);
  if (amount.lte(0)) return null;
  const buyPrice = new Decimal(buy.close);
  const sellPrice = new Decimal(sell.close);
  if (buyPrice.lte(0)) return null;
  const shares = amount.div(buyPrice);
  const saleValue = shares.mul(sellPrice);
  const pnl = saleValue.minus(amount);
  const pnlPct = pnl.div(amount).mul(100);
  return {
    buyTime: buy.time,
    buyPrice: buyPrice.toNumber(),
    sellTime: sell.time,
    sellPrice: sellPrice.toNumber(),
    shares: shares.toNumber(),
    saleValue: saleValue.toNumber(),
    pnl: pnl.toNumber(),
    pnlPct: pnlPct.toNumber(),
  };
}
