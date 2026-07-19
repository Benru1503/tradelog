import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { previewAveraging, decoratePosition } from "@/lib/positions";
import type { Position } from "@prisma/client";

function position(opts: {
  totalQty: number | string;
  avgCost: number | string;
  direction?: Position["direction"];
}): Position {
  const now = new Date("2026-01-01");
  return {
    id: "p1",
    userId: "u1",
    asset: "TEST",
    assetType: "STOCK",
    direction: opts.direction ?? "LONG",
    status: "OPEN",
    openedAt: now,
    closedAt: null,
    avgCost: new Decimal(opts.avgCost) as unknown as Position["avgCost"],
    totalQty: new Decimal(opts.totalQty) as unknown as Position["totalQty"],
    realizedPnl: new Decimal(0) as unknown as Position["realizedPnl"],
    createdAt: now,
    updatedAt: now,
  };
}

describe("previewAveraging", () => {
  it("computes the weighted average when adding a leg at a higher price", () => {
    const p = previewAveraging(position({ totalQty: 10, avgCost: 100 }), 10, 200);
    expect(p.beforeCost.toNumber()).toBe(1000);
    expect(p.addingCost.toNumber()).toBe(2000);
    expect(p.afterQty.toNumber()).toBe(20);
    expect(p.afterAvg.toNumber()).toBe(150);
    expect(p.afterCost.toNumber()).toBe(3000);
  });

  it("first leg into an empty position: average equals the added price", () => {
    const p = previewAveraging(position({ totalQty: 0, avgCost: 0 }), 5, 40);
    expect(p.afterQty.toNumber()).toBe(5);
    expect(p.afterAvg.toNumber()).toBe(40);
  });

  it("accepts string inputs without losing precision", () => {
    const p = previewAveraging(position({ totalQty: "0.5", avgCost: "20000" }), "0.5", "30000");
    expect(p.afterAvg.toNumber()).toBe(25000);
  });
});

describe("decoratePosition", () => {
  const price = (p: number) => ({ price: p, fetchedAt: new Date("2026-01-02") });

  it("LONG position gains when price rises above avg cost", () => {
    const row = decoratePosition(position({ totalQty: 10, avgCost: 100 }), price(110));
    expect(row.costBasis).toBe(1000);
    expect(row.marketValue).toBe(1100);
    expect(row.unrealizedPnl).toBe(100);
    expect(row.unrealizedPct).toBeCloseTo(10, 6);
  });

  it("SHORT position gains when price drops below avg cost", () => {
    const row = decoratePosition(
      position({ totalQty: 10, avgCost: 100, direction: "SHORT" }),
      price(90),
    );
    expect(row.unrealizedPnl).toBe(100);
    expect(row.unrealizedPct).toBeCloseTo(10, 6);
  });

  it("SHORT position loses when price rises", () => {
    const row = decoratePosition(
      position({ totalQty: 10, avgCost: 100, direction: "SHORT" }),
      price(120),
    );
    expect(row.unrealizedPnl).toBe(-200);
    expect(row.unrealizedPct).toBeCloseTo(-20, 6);
  });

  it("no market price → cost basis still computed, market fields null", () => {
    const row = decoratePosition(position({ totalQty: 10, avgCost: 100 }), null);
    expect(row.costBasis).toBe(1000);
    expect(row.marketPrice).toBeNull();
    expect(row.marketValue).toBeNull();
    expect(row.unrealizedPnl).toBeNull();
    expect(row.unrealizedPct).toBeNull();
  });

  it("zero remaining quantity → no market value or unrealized P&L", () => {
    const row = decoratePosition(position({ totalQty: 0, avgCost: 100 }), price(110));
    expect(row.costBasis).toBe(0);
    expect(row.marketValue).toBeNull();
    expect(row.unrealizedPnl).toBeNull();
  });

  it("crypto-scale decimals survive the round trip", () => {
    const row = decoratePosition(position({ totalQty: "0.25", avgCost: "40000" }), price(48000));
    expect(row.costBasis).toBe(10000);
    expect(row.marketValue).toBe(12000);
    expect(row.unrealizedPnl).toBe(2000);
  });
});
