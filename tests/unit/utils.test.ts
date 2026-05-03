import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { calcPnL, formatCurrency, formatPercent, formatNumber } from "@/lib/utils";

describe("calcPnL", () => {
  it("computes long P&L gross of fees", () => {
    const r = calcPnL({
      entryPrice: 100,
      exitPrice: 110,
      quantity: 10,
      fees: 0,
      direction: "LONG",
    });
    expect(r?.pnl.toString()).toBe("100");
    expect(r?.pnlPercent.toString()).toBe("10");
  });

  it("subtracts fees from P&L", () => {
    const r = calcPnL({
      entryPrice: 100,
      exitPrice: 110,
      quantity: 10,
      fees: 5,
      direction: "LONG",
    });
    expect(r?.pnl.toString()).toBe("95");
  });

  it("inverts P&L for SHORT", () => {
    const r = calcPnL({
      entryPrice: 100,
      exitPrice: 90,
      quantity: 10,
      fees: 0,
      direction: "SHORT",
    });
    expect(r?.pnl.toString()).toBe("100");
  });

  it("returns null when exit price is missing", () => {
    const r = calcPnL({
      entryPrice: 100,
      exitPrice: null,
      quantity: 10,
      fees: 0,
      direction: "LONG",
    });
    expect(r).toBeNull();
  });

  it("preserves precision with crypto-scale decimals", () => {
    const r = calcPnL({
      entryPrice: "0.00001234",
      exitPrice: "0.00001500",
      quantity: "1000000",
      fees: "0.5",
      direction: "LONG",
    });
    // (0.00001500 - 0.00001234) * 1_000_000 - 0.5 = 2.66 - 0.5 = 2.16
    expect(r?.pnl.toString()).toBe("2.16");
  });
});

describe("formatters", () => {
  it("formats currency with default locale", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });

  it("adds + sign when signed and positive", () => {
    expect(formatCurrency(100, { signed: true })).toBe("+$100.00");
  });

  it("does not add + sign for negative", () => {
    expect(formatCurrency(-100, { signed: true })).toBe("-$100.00");
  });

  it("returns em-dash for null", () => {
    expect(formatCurrency(null)).toBe("—");
  });

  it("formats percent with 2 decimals", () => {
    expect(formatPercent(12.345)).toBe("12.35%");
  });

  it("formats Decimal types", () => {
    expect(formatNumber(new Decimal("100.123"), 2)).toBe("100.12");
  });
});
