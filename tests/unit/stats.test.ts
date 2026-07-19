import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { computeStats } from "@/lib/stats";
import type { Trade } from "@prisma/client";

function trade(opts: { id: string; status?: Trade["status"]; pnl?: number | null }): Trade {
  const now = new Date("2026-01-01");
  return {
    id: opts.id,
    userId: "u1",
    positionId: null,
    asset: "TEST",
    assetType: "STOCK",
    direction: "LONG",
    entryPrice: new Decimal(100) as unknown as Trade["entryPrice"],
    exitPrice: new Decimal(100) as unknown as Trade["exitPrice"],
    quantity: new Decimal(1) as unknown as Trade["quantity"],
    entryDate: now,
    exitDate: now,
    status: opts.status ?? "CLOSED",
    pnl: (opts.pnl == null ? null : new Decimal(opts.pnl)) as unknown as Trade["pnl"],
    pnlPercent: new Decimal(0) as unknown as Trade["pnlPercent"],
    fees: new Decimal(0) as unknown as Trade["fees"],
    notes: null,
    isShared: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe("computeStats", () => {
  it("returns zeros for an empty trade list", () => {
    const s = computeStats([]);
    expect(s.totalTrades).toBe(0);
    expect(s.winRate).toBe(0);
    expect(s.totalPnl).toBe(0);
    expect(s.bestTrade).toBe(0);
    expect(s.worstTrade).toBe(0);
    expect(s.avgRR).toBe(0);
  });

  it("computes win rate, averages, and extremes over closed trades", () => {
    const trades = [
      trade({ id: "t1", pnl: 100 }),
      trade({ id: "t2", pnl: 300 }),
      trade({ id: "t3", pnl: -100 }),
      trade({ id: "t4", status: "OPEN", pnl: null }),
    ];
    const s = computeStats(trades);
    expect(s.totalTrades).toBe(4);
    expect(s.closedTrades).toBe(3);
    expect(s.openTrades).toBe(1);
    expect(s.winningTrades).toBe(2);
    expect(s.losingTrades).toBe(1);
    expect(s.winRate).toBeCloseTo((2 / 3) * 100, 6);
    expect(s.totalPnl).toBe(300);
    expect(s.avgWin).toBe(200);
    expect(s.avgLoss).toBe(-100);
    expect(s.avgRR).toBe(2);
    expect(s.bestTrade).toBe(300);
    expect(s.worstTrade).toBe(-100);
  });

  it("avgRR is 0 when there are no losing trades (documented guard)", () => {
    const s = computeStats([trade({ id: "t1", pnl: 50 })]);
    expect(s.avgLoss).toBe(0);
    expect(s.avgRR).toBe(0);
  });

  it("a break-even trade is neither a win nor a loss but counts as closed", () => {
    const s = computeStats([trade({ id: "t1", pnl: 0 })]);
    expect(s.closedTrades).toBe(1);
    expect(s.winningTrades).toBe(0);
    expect(s.losingTrades).toBe(0);
    expect(s.winRate).toBe(0);
  });

  it("open trades never contribute to P&L totals", () => {
    const s = computeStats([
      trade({ id: "t1", status: "OPEN", pnl: null }),
      trade({ id: "t2", pnl: -40 }),
    ]);
    expect(s.totalPnl).toBe(-40);
    expect(s.openTrades).toBe(1);
  });
});
