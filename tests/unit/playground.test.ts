import { describe, it, expect } from "vitest";
import { pickCandleAt, simulateWhatIf, simulateDca, xirr } from "@/lib/playground";
import type { Candle } from "@/lib/marketdata/candles";

function candle(dateISO: string, close: number): Candle {
  const t = Math.floor(new Date(dateISO).getTime() / 1000);
  return { time: t, open: close, high: close, low: close, close };
}

const SERIES: Candle[] = [
  candle("2024-01-02", 100),
  candle("2024-01-03", 110),
  candle("2024-01-04", 120),
  candle("2024-06-01", 200),
  candle("2024-12-31", 250),
];

describe("pickCandleAt", () => {
  it("snaps a weekend pick to the closest weekday bar", () => {
    // 2024-01-06 is Saturday; nearest bar is 2024-01-04.
    const c = pickCandleAt(SERIES, new Date("2024-01-06"));
    expect(c?.close).toBe(120);
  });

  it("returns null on an empty series", () => {
    expect(pickCandleAt([], new Date())).toBeNull();
  });
});

describe("simulateWhatIf", () => {
  it("buys at entry close, sells at exit close, computes P&L", () => {
    const r = simulateWhatIf(SERIES, {
      buyAmount: 1000,
      buyDate: new Date("2024-01-02"),
      sellDate: new Date("2024-12-31"),
    });
    expect(r).not.toBeNull();
    expect(r!.buyPrice).toBe(100);
    expect(r!.sellPrice).toBe(250);
    expect(r!.shares).toBe(10);
    expect(r!.saleValue).toBe(2500);
    expect(r!.pnl).toBe(1500);
    expect(r!.pnlPct).toBe(150);
  });

  it("uses the latest candle when sellDate is null", () => {
    const r = simulateWhatIf(SERIES, {
      buyAmount: 500,
      buyDate: new Date("2024-01-02"),
      sellDate: null,
    });
    expect(r!.sellPrice).toBe(250);
    expect(r!.shares).toBe(5);
    expect(r!.pnl).toBe(750);
  });

  it("returns null on an empty candle series", () => {
    const r = simulateWhatIf([], {
      buyAmount: 1000,
      buyDate: new Date(),
      sellDate: null,
    });
    expect(r).toBeNull();
  });

  it("rejects a non-positive buy amount", () => {
    const r = simulateWhatIf(SERIES, {
      buyAmount: 0,
      buyDate: new Date("2024-01-02"),
      sellDate: null,
    });
    expect(r).toBeNull();
  });
});

// Deterministic daily series — flat-then-doubled price so the DCA math is
// trivially checkable: every contribution at $100 buys 1 share, then price
// doubles to $200 at the end.
function dailyConstantSeries(
  startISO: string,
  days: number,
  prices: (i: number) => number,
): Candle[] {
  const t0 = new Date(startISO).getTime();
  return Array.from({ length: days }, (_, i) => {
    const close = prices(i);
    return {
      time: Math.floor((t0 + i * 86400_000) / 1000),
      open: close,
      high: close,
      low: close,
      close,
    };
  });
}

describe("xirr", () => {
  it("solves ~10% annualized for a 1-year +10% lump", () => {
    const t0 = Math.floor(new Date("2024-01-01").getTime() / 1000);
    const r = xirr([
      { time: t0, amount: -1000 },
      { time: t0 + 365 * 86400, amount: 1100 },
    ]);
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(0.099);
    expect(r!).toBeLessThan(0.101);
  });

  it("returns null when there's no sign change", () => {
    const t0 = Math.floor(Date.now() / 1000);
    const r = xirr([
      { time: t0, amount: -100 },
      { time: t0 + 86400, amount: -100 },
    ]);
    expect(r).toBeNull();
  });
});

describe("simulateDca", () => {
  it("monthly DCA at flat price: invested == final value, P&L == 0", () => {
    // 13 months of flat $100 candles.
    const series = dailyConstantSeries("2024-01-01", 400, () => 100);
    const r = simulateDca(series, {
      amount: 100,
      cadence: "MONTHLY",
      from: new Date("2024-01-01"),
      to: new Date("2025-01-01"),
    });
    expect(r).not.toBeNull();
    expect(r!.contributions.length).toBe(13);
    expect(r!.totalInvested).toBe(1300);
    expect(r!.finalValue).toBeCloseTo(1300, 5);
    expect(r!.pnl).toBeCloseTo(0, 5);
    expect(r!.totalShares).toBeCloseTo(13, 5);
  });

  it("price doubles after final contribution: P&L doubles invested", () => {
    // 12 monthly buys at $100, then price stays at $200 for the final point.
    const series = dailyConstantSeries("2024-01-01", 400, (i) => (i < 365 ? 100 : 200));
    const r = simulateDca(series, {
      amount: 100,
      cadence: "MONTHLY",
      from: new Date("2024-01-01"),
      to: new Date("2025-02-01"),
    });
    expect(r).not.toBeNull();
    // 14 monthly buys (Jan 2024 through Feb 2025) — confirm by length.
    expect(r!.contributions.length).toBe(14);
    // First 12 buys at $100 (1 share each), last 2 at $200 (0.5 each).
    // Total shares: 12 + 1 = 13.
    expect(r!.totalShares).toBeCloseTo(13, 5);
    expect(r!.totalInvested).toBe(1400);
    // Final value: 13 shares * $200 = $2600.
    expect(r!.finalValue).toBeCloseTo(2600, 5);
    expect(r!.pnl).toBeCloseTo(1200, 5);
  });

  it("weekly cadence produces ~52 contributions over a year", () => {
    const series = dailyConstantSeries("2024-01-01", 400, () => 50);
    const r = simulateDca(series, {
      amount: 25,
      cadence: "WEEKLY",
      from: new Date("2024-01-01"),
      to: new Date("2024-12-31"),
    });
    expect(r).not.toBeNull();
    expect(r!.contributions.length).toBeGreaterThanOrEqual(52);
    expect(r!.contributions.length).toBeLessThanOrEqual(53);
  });

  it("uses latest candle when `to` is null", () => {
    const series = dailyConstantSeries("2024-01-01", 200, () => 100);
    const r = simulateDca(series, {
      amount: 100,
      cadence: "MONTHLY",
      from: new Date("2024-01-01"),
      to: null,
    });
    expect(r).not.toBeNull();
    // Final time matches last candle.
    expect(r!.toTime).toBe(series[series.length - 1]!.time);
  });

  it("returns null on empty candle series", () => {
    const r = simulateDca([], {
      amount: 100,
      cadence: "MONTHLY",
      from: new Date("2024-01-01"),
      to: null,
    });
    expect(r).toBeNull();
  });

  it("returns null on non-positive amount", () => {
    const series = dailyConstantSeries("2024-01-01", 30, () => 100);
    const r = simulateDca(series, {
      amount: 0,
      cadence: "MONTHLY",
      from: new Date("2024-01-01"),
      to: null,
    });
    expect(r).toBeNull();
  });
});
