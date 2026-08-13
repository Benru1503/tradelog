import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import type { CashFlow, Trade } from "@prisma/client";
import { buildCoachFacts, hasEnoughHistory, type TradeWithTags } from "@/lib/coach/facts";

const HOUR = 60 * 60 * 1000;

function trade(opts: {
  id: string;
  pnl?: number | null;
  pnlPercent?: number | null;
  entry?: string;
  exit?: string | null;
  status?: Trade["status"];
  asset?: string;
  assetType?: Trade["assetType"];
  direction?: Trade["direction"];
  entryPrice?: number;
  quantity?: number;
  fees?: number;
  notes?: string | null;
  tagNames?: string[];
  deletedAt?: Date | null;
}): TradeWithTags {
  const entryDate = new Date(opts.entry ?? "2026-01-01T00:00:00.000Z");
  const exitDate = opts.exit === null ? null : new Date(opts.exit ?? "2026-01-02T00:00:00.000Z");
  const d = (n: number) => new Decimal(n) as unknown as Trade["entryPrice"];
  return {
    id: opts.id,
    userId: "u1",
    positionId: null,
    asset: opts.asset ?? "TEST",
    assetType: opts.assetType ?? "STOCK",
    direction: opts.direction ?? "LONG",
    entryPrice: d(opts.entryPrice ?? 100),
    exitPrice: d(110) as Trade["exitPrice"],
    quantity: d(opts.quantity ?? 1) as Trade["quantity"],
    entryDate,
    exitDate,
    status: opts.status ?? "CLOSED",
    pnl: (opts.pnl == null ? null : new Decimal(opts.pnl)) as unknown as Trade["pnl"],
    pnlPercent: (opts.pnlPercent == null
      ? null
      : new Decimal(opts.pnlPercent)) as unknown as Trade["pnlPercent"],
    fees: d(opts.fees ?? 0) as Trade["fees"],
    notes: opts.notes ?? null,
    isShared: false,
    deletedAt: opts.deletedAt ?? null,
    createdAt: entryDate,
    updatedAt: entryDate,
    tagNames: opts.tagNames ?? [],
  };
}

function flow(type: CashFlow["type"], amount: number): CashFlow {
  return {
    id: `cf-${type}-${amount}`,
    userId: "u1",
    type,
    amount: new Decimal(amount) as unknown as CashFlow["amount"],
    currency: "USD",
    occurredAt: new Date("2026-01-01"),
    note: null,
    assetSymbol: null,
    createdAt: new Date("2026-01-01"),
  } as CashFlow;
}

describe("buildCoachFacts — summary", () => {
  it("counts wins, losses and break-even separately", () => {
    const facts = buildCoachFacts(
      [
        trade({ id: "a", pnl: 100 }),
        trade({ id: "b", pnl: -50 }),
        trade({ id: "c", pnl: 0 }),
        trade({ id: "d", pnl: null, status: "OPEN", exit: null }),
      ],
      [],
    );
    expect(facts.summary.totalTrades).toBe(4);
    expect(facts.summary.closedTrades).toBe(3);
    expect(facts.summary.openTrades).toBe(1);
    expect(facts.summary.winningTrades).toBe(1);
    expect(facts.summary.losingTrades).toBe(1);
    // A flat trade is neither a win nor a loss — same rule as computeStats.
    expect(facts.summary.breakEvenTrades).toBe(1);
    expect(facts.summary.totalPnl).toBe(50);
  });

  it("excludes soft-deleted trades", () => {
    const facts = buildCoachFacts(
      [trade({ id: "a", pnl: 100 }), trade({ id: "b", pnl: -999, deletedAt: new Date() })],
      [],
    );
    expect(facts.summary.totalTrades).toBe(1);
    expect(facts.summary.totalPnl).toBe(100);
  });

  it("returns nulls rather than zeros when there is nothing to average", () => {
    const facts = buildCoachFacts([], []);
    expect(facts.summary.winRatePct).toBeNull();
    expect(facts.winLoss.avgWin).toBeNull();
    expect(facts.winLoss.payoffRatio).toBeNull();
    expect(facts.holdTime.loserToWinnerHoldRatio).toBeNull();
    expect(hasEnoughHistory(facts)).toBe(false);
  });
});

describe("buildCoachFacts — hold time asymmetry", () => {
  it("measures winners and losers separately and reports the ratio", () => {
    const facts = buildCoachFacts(
      [
        // Winner held 2h, loser held 10h → disposition effect of 5x.
        trade({
          id: "w",
          pnl: 100,
          entry: "2026-01-01T00:00:00.000Z",
          exit: "2026-01-01T02:00:00.000Z",
        }),
        trade({
          id: "l",
          pnl: -100,
          entry: "2026-01-01T00:00:00.000Z",
          exit: "2026-01-01T10:00:00.000Z",
        }),
      ],
      [],
    );
    expect(facts.holdTime.avgHoldHoursWinners).toBe(2);
    expect(facts.holdTime.avgHoldHoursLosers).toBe(10);
    expect(facts.holdTime.loserToWinnerHoldRatio).toBe(5);
  });
});

describe("buildCoachFacts — revenge trades", () => {
  it("flags entries opened within 24h of realising a loss", () => {
    const lossExit = new Date("2026-01-01T12:00:00.000Z");
    const facts = buildCoachFacts(
      [
        trade({
          id: "loss",
          pnl: -200,
          entry: "2026-01-01T00:00:00.000Z",
          exit: lossExit.toISOString(),
        }),
        // 3h after the loss → inside the window.
        trade({
          id: "tilt",
          pnl: -80,
          entry: new Date(lossExit.getTime() + 3 * HOUR).toISOString(),
          exit: "2026-01-01T20:00:00.000Z",
        }),
        // Days after every loss exit → outside the window.
        trade({
          id: "calm",
          pnl: 50,
          entry: "2026-01-05T00:00:00.000Z",
          exit: "2026-01-06T00:00:00.000Z",
        }),
      ],
      [],
    );
    expect(facts.revenge.tradesAfterLoss).toBe(1);
    expect(facts.revenge.totalPnl).toBe(-80);
    expect(facts.revenge.winRatePct).toBe(0);
  });

  it("cascades: a revenge trade that also loses opens a fresh window", () => {
    const facts = buildCoachFacts(
      [
        trade({
          id: "loss",
          pnl: -200,
          entry: "2026-01-01T00:00:00.000Z",
          exit: "2026-01-01T12:00:00.000Z",
        }),
        // 3h after the first loss, and itself a loser.
        trade({
          id: "tilt1",
          pnl: -80,
          entry: "2026-01-01T15:00:00.000Z",
          exit: "2026-01-02T00:00:00.000Z",
        }),
        // 6h after tilt1's loss → still tilting.
        trade({
          id: "tilt2",
          pnl: -30,
          entry: "2026-01-02T06:00:00.000Z",
          exit: "2026-01-02T12:00:00.000Z",
        }),
      ],
      [],
    );
    expect(facts.revenge.tradesAfterLoss).toBe(2);
    expect(facts.revenge.totalPnl).toBe(-110);
    expect(facts.revenge.baselineWinRatePct).toBe(0);
  });
});

describe("buildCoachFacts — streaks", () => {
  it("tracks longest win and loss runs in exit order", () => {
    const facts = buildCoachFacts(
      [
        trade({ id: "1", pnl: 10, exit: "2026-01-01T00:00:00.000Z" }),
        trade({ id: "2", pnl: -10, exit: "2026-01-02T00:00:00.000Z" }),
        trade({ id: "3", pnl: -10, exit: "2026-01-03T00:00:00.000Z" }),
        trade({ id: "4", pnl: -10, exit: "2026-01-04T00:00:00.000Z" }),
        trade({ id: "5", pnl: 10, exit: "2026-01-05T00:00:00.000Z" }),
        trade({ id: "6", pnl: 10, exit: "2026-01-06T00:00:00.000Z" }),
      ],
      [],
    );
    expect(facts.streaks.maxConsecutiveLosses).toBe(3);
    expect(facts.streaks.maxConsecutiveWins).toBe(2);
  });
});

describe("buildCoachFacts — buckets", () => {
  it("groups by tag, counting a trade once per tag", () => {
    const facts = buildCoachFacts(
      [
        trade({ id: "a", pnl: 100, tagNames: ["breakout", "earnings"] }),
        trade({ id: "b", pnl: -40, tagNames: ["breakout"] }),
        trade({ id: "c", pnl: 10, tagNames: [] }),
      ],
      [],
    );
    const breakout = facts.byTag.find((b) => b.key === "breakout");
    expect(breakout?.trades).toBe(2);
    expect(breakout?.winRatePct).toBe(50);
    expect(breakout?.totalPnl).toBe(60);
    expect(facts.byTag.find((b) => b.key === "(untagged)")?.trades).toBe(1);
  });

  it("groups by direction and asset type", () => {
    const facts = buildCoachFacts(
      [
        trade({ id: "a", pnl: 100, direction: "LONG", assetType: "CRYPTO" }),
        trade({ id: "b", pnl: -40, direction: "SHORT", assetType: "STOCK" }),
      ],
      [],
    );
    expect(facts.byDirection.find((b) => b.key === "LONG")?.totalPnl).toBe(100);
    expect(facts.byAssetType.find((b) => b.key === "CRYPTO")?.trades).toBe(1);
  });
});

describe("buildCoachFacts — fees, sizing and cash", () => {
  it("measures fee drag against gross P&L", () => {
    const facts = buildCoachFacts(
      [trade({ id: "a", pnl: 90, fees: 10 }), trade({ id: "b", pnl: 90, fees: 10 })],
      [],
    );
    // Net 180, fees 20 → gross 200, drag 10%.
    expect(facts.fees.totalFees).toBe(20);
    expect(facts.fees.feesAsPctOfGrossPnl).toBe(10);
  });

  it("compares the largest loss's position size to the average", () => {
    const facts = buildCoachFacts(
      [
        trade({ id: "small", pnl: 10, entryPrice: 100, quantity: 1 }),
        trade({ id: "big", pnl: -500, entryPrice: 100, quantity: 3 }),
      ],
      [],
    );
    expect(facts.sizing.notionalOfLargestLoss).toBe(300);
    // Average notional is (100 + 300) / 2 = 200 → 1.5x.
    expect(facts.sizing.largestLossSizeVsAverage).toBe(1.5);
  });

  it("totals cash flows by type", () => {
    const facts = buildCoachFacts(
      [trade({ id: "a", pnl: 10 })],
      [flow("DEPOSIT", 1000), flow("WITHDRAWAL", 200), flow("DIVIDEND", 15)],
    );
    expect(facts.cash.deposits).toBe(1000);
    expect(facts.cash.dividends).toBe(15);
    expect(facts.cash.netContributed).toBe(800);
  });
});

describe("buildCoachFacts — payload hygiene", () => {
  it("truncates long notes and caps how many are sent", () => {
    const long = "x".repeat(1000);
    const trades = Array.from({ length: 25 }, (_, i) =>
      trade({
        id: `t${i}`,
        pnl: 1,
        notes: long,
        entry: `2026-01-${String(i + 1).padStart(2, "0")}`,
      }),
    );
    const facts = buildCoachFacts(trades, []);
    expect(facts.recentNotes.length).toBeLessThanOrEqual(15);
    for (const n of facts.recentNotes) {
      expect(n.note.length).toBeLessThanOrEqual(240);
    }
  });

  it("reports best and worst trades with context", () => {
    const facts = buildCoachFacts(
      [
        trade({ id: "best", pnl: 500, asset: "NVDA", pnlPercent: 25 }),
        trade({ id: "mid", pnl: 10, asset: "SPY" }),
        trade({ id: "worst", pnl: -300, asset: "TSLA", pnlPercent: -15 }),
      ],
      [],
    );
    expect(facts.extremes.best[0].asset).toBe("NVDA");
    expect(facts.extremes.best[0].pnlPercent).toBe(25);
    expect(facts.extremes.worst[0].asset).toBe("TSLA");
  });

  it("requires a minimum number of closed trades before coaching", () => {
    const few = buildCoachFacts([trade({ id: "a", pnl: 1 })], []);
    expect(hasEnoughHistory(few)).toBe(false);

    const enough = buildCoachFacts(
      Array.from({ length: 5 }, (_, i) => trade({ id: `t${i}`, pnl: 1 })),
      [],
    );
    expect(hasEnoughHistory(enough)).toBe(true);
  });
});
