// Deterministic fact extraction for the /coach feature.
//
// THIS MODULE OWNS EVERY NUMBER THE COACH EVER SHOWS. The language model is
// given this payload and asked to interpret it — it is never asked to compute.
// That split is the whole anti-hallucination story: if a figure appears in a
// coach report, it was computed here, in TypeScript, from the database.
//
// Pure and Prisma-free (takes plain rows, returns plain data) so the unit
// suite can pin every metric — see tests/unit/coach-facts.test.ts.

import Decimal from "decimal.js";
import type { CashFlow, Trade } from "@prisma/client";

/** A trade plus the flattened names of its tags. */
export type TradeWithTags = Trade & { tagNames: string[] };

const MS_PER_HOUR = 60 * 60 * 1000;
/** A new entry within this window of a losing exit is flagged as a possible tilt trade. */
const REVENGE_WINDOW_HOURS = 24;
const MAX_TAGS = 12;
const MAX_MONTHS = 18;
const MAX_NOTES = 15;
const NOTE_CHARS = 240;
const EXTREMES = 3;

export interface Bucket {
  key: string;
  trades: number;
  wins: number;
  winRatePct: number | null;
  totalPnl: number;
  avgPnl: number;
}

export interface TradeRef {
  asset: string;
  direction: string;
  pnl: number;
  pnlPercent: number | null;
  holdDays: number | null;
  entryDate: string;
  tags: string[];
  note: string | null;
}

export interface CoachFacts {
  generatedAt: string;
  window: { firstTradeDate: string | null; lastTradeDate: string | null; months: number };
  summary: {
    totalTrades: number;
    closedTrades: number;
    openTrades: number;
    winningTrades: number;
    losingTrades: number;
    breakEvenTrades: number;
    winRatePct: number | null;
    totalPnl: number;
    expectancyPerTrade: number | null;
  };
  winLoss: {
    avgWin: number | null;
    avgLoss: number | null;
    payoffRatio: number | null;
    avgWinPct: number | null;
    avgLossPct: number | null;
    largestWin: number | null;
    largestLoss: number | null;
  };
  holdTime: {
    avgHoldHoursWinners: number | null;
    avgHoldHoursLosers: number | null;
    medianHoldHoursWinners: number | null;
    medianHoldHoursLosers: number | null;
    /** >1 means losers are held longer than winners — the classic disposition effect. */
    loserToWinnerHoldRatio: number | null;
  };
  sizing: {
    avgNotionalWinners: number | null;
    avgNotionalLosers: number | null;
    largestNotional: number | null;
    notionalOfLargestLoss: number | null;
    /** Largest-loss notional divided by the average notional of all closed trades. */
    largestLossSizeVsAverage: number | null;
  };
  streaks: { maxConsecutiveWins: number; maxConsecutiveLosses: number };
  fees: { totalFees: number; feesAsPctOfGrossPnl: number | null };
  revenge: {
    windowHours: number;
    tradesAfterLoss: number;
    winRatePct: number | null;
    totalPnl: number;
    /** Baseline win rate over all closed trades, for comparison. */
    baselineWinRatePct: number | null;
  };
  byAssetType: Bucket[];
  byDirection: Bucket[];
  byTag: Bucket[];
  byEntryWeekday: Bucket[];
  activity: Array<{ month: string; trades: number; pnl: number }>;
  discipline: {
    pctTradesWithNotes: number | null;
    pctTradesWithTags: number | null;
    avgTradesPerMonth: number | null;
  };
  cash: {
    deposits: number;
    withdrawals: number;
    dividends: number;
    feeAdjustments: number;
    netContributed: number;
  };
  extremes: { best: TradeRef[]; worst: TradeRef[] };
  /** Recent journal notes paired with how the trade actually turned out. */
  recentNotes: Array<{ asset: string; outcome: string; pnl: number | null; note: string }>;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function round(value: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

function pnlOf(t: Trade): Decimal | null {
  return t.pnl === null || t.pnl === undefined ? null : new Decimal(t.pnl);
}

// Generic so filtering a TradeWithTags[] keeps its tagNames rather than
// widening back to Trade.
function isClosed<T extends Trade>(t: T): t is T & { pnl: Decimal } {
  return t.status === "CLOSED" && t.pnl !== null && t.pnl !== undefined;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** mean() then round(), preserving null for an empty input. */
function avgRounded(values: number[], dp = 2): number | null {
  const m = mean(values);
  return m === null ? null : round(m, dp);
}

function pnlPercents(trades: Trade[]): number[] {
  return trades
    .map((t) => (t.pnlPercent === null ? null : new Decimal(t.pnlPercent).toNumber()))
    .filter((v): v is number => v !== null);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function sumPnl(trades: Trade[]): number {
  return trades.reduce((acc, t) => acc.plus(t.pnl ?? 0), new Decimal(0)).toNumber();
}

/** Hold duration in hours, or null when either endpoint is missing. */
function holdHours(t: Trade): number | null {
  if (!t.exitDate) return null;
  const ms = t.exitDate.getTime() - t.entryDate.getTime();
  return ms >= 0 ? ms / MS_PER_HOUR : null;
}

function notional(t: Trade): number {
  return new Decimal(t.entryPrice).times(t.quantity).abs().toNumber();
}

function truncate(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

/** Group closed trades into a comparable bucket list, largest first. */
function bucketBy<T extends Trade>(
  closed: T[],
  keyOf: (t: T) => string | string[],
  limit?: number,
): Bucket[] {
  const groups = new Map<string, T[]>();
  for (const t of closed) {
    const raw = keyOf(t);
    for (const key of Array.isArray(raw) ? raw : [raw]) {
      const list = groups.get(key);
      if (list) list.push(t);
      else groups.set(key, [t]);
    }
  }
  const buckets = [...groups.entries()].map(([key, list]) => {
    const wins = list.filter((t) => new Decimal(t.pnl!).gt(0)).length;
    const totalPnl = sumPnl(list);
    return {
      key,
      trades: list.length,
      wins,
      winRatePct: list.length === 0 ? null : round((wins / list.length) * 100, 1),
      totalPnl: round(totalPnl),
      avgPnl: round(totalPnl / list.length),
    };
  });
  buckets.sort((a, b) => b.trades - a.trades || a.key.localeCompare(b.key));
  return limit === undefined ? buckets : buckets.slice(0, limit);
}

function toRef(t: TradeWithTags): TradeRef {
  const hours = holdHours(t);
  return {
    asset: t.asset,
    direction: t.direction,
    pnl: round(new Decimal(t.pnl ?? 0).toNumber()),
    pnlPercent: t.pnlPercent === null ? null : round(new Decimal(t.pnlPercent).toNumber(), 2),
    holdDays: hours === null ? null : round(hours / 24, 1),
    entryDate: t.entryDate.toISOString().slice(0, 10),
    tags: t.tagNames,
    note: t.notes ? truncate(t.notes, NOTE_CHARS) : null,
  };
}

/**
 * Reduce a user's trading history to the fact sheet the coach reasons over.
 * Every field is derived here; nothing downstream recomputes.
 */
export function buildCoachFacts(
  trades: TradeWithTags[],
  cashFlows: CashFlow[],
  now: Date = new Date(),
): CoachFacts {
  const active = trades.filter((t) => t.deletedAt === null);
  const closed = active.filter(isClosed);
  const wins = closed.filter((t) => new Decimal(t.pnl!).gt(0));
  const losses = closed.filter((t) => new Decimal(t.pnl!).lt(0));
  const breakEven = closed.length - wins.length - losses.length;

  const totalPnl = sumPnl(closed);
  const winRatePct = closed.length === 0 ? null : round((wins.length / closed.length) * 100, 1);
  const avgWin = wins.length === 0 ? null : sumPnl(wins) / wins.length;
  const avgLoss = losses.length === 0 ? null : sumPnl(losses) / losses.length;

  // Hold-time asymmetry: the single most diagnostic behavioural metric here.
  const winnerHolds = wins.map(holdHours).filter((h): h is number => h !== null);
  const loserHolds = losses.map(holdHours).filter((h): h is number => h !== null);
  const avgWinnerHold = mean(winnerHolds);
  const avgLoserHold = mean(loserHolds);
  const medianWinnerHold = median(winnerHolds);
  const medianLoserHold = median(loserHolds);

  // Tilt detection: entries opened shortly after a loss was realised.
  const lossExits = losses
    .map((t) => t.exitDate)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  const revengeTrades = active.filter((t) =>
    lossExits.some((exit) => {
      const gap = t.entryDate.getTime() - exit.getTime();
      return gap > 0 && gap <= REVENGE_WINDOW_HOURS * MS_PER_HOUR;
    }),
  );
  const revengeClosed = revengeTrades.filter(isClosed);
  const revengeWins = revengeClosed.filter((t) => new Decimal(t.pnl!).gt(0)).length;

  // Streaks run in realisation order, so sort by exit rather than entry.
  const byExit = [...closed].sort(
    (a, b) => (a.exitDate?.getTime() ?? 0) - (b.exitDate?.getTime() ?? 0),
  );
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let winRun = 0;
  let lossRun = 0;
  for (const t of byExit) {
    const p = new Decimal(t.pnl!);
    if (p.gt(0)) {
      winRun += 1;
      lossRun = 0;
    } else if (p.lt(0)) {
      lossRun += 1;
      winRun = 0;
    } else {
      winRun = 0;
      lossRun = 0;
    }
    maxWinStreak = Math.max(maxWinStreak, winRun);
    maxLossStreak = Math.max(maxLossStreak, lossRun);
  }

  const totalFees = active.reduce((acc, t) => acc.plus(t.fees ?? 0), new Decimal(0)).toNumber();
  // Gross = net P&L before fees, so fee drag is measured against what the
  // strategy actually earned rather than against the after-fee remainder.
  const grossPnl = closed
    .reduce((acc, t) => acc.plus(t.pnl ?? 0).plus(t.fees ?? 0), new Decimal(0))
    .toNumber();

  const closedNotionals = closed.map(notional);
  const largestLoss = losses.length
    ? losses.reduce((worst, t) => (new Decimal(t.pnl!).lt(worst.pnl!) ? t : worst))
    : null;

  const monthly = new Map<string, { trades: number; pnl: Decimal }>();
  for (const t of active) {
    const month = t.entryDate.toISOString().slice(0, 7);
    const entry = monthly.get(month) ?? { trades: 0, pnl: new Decimal(0) };
    entry.trades += 1;
    entry.pnl = entry.pnl.plus(t.pnl ?? 0);
    monthly.set(month, entry);
  }
  const activity = [...monthly.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-MAX_MONTHS)
    .map(([month, v]) => ({ month, trades: v.trades, pnl: round(v.pnl.toNumber()) }));

  const sortedByDate = [...active].sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());
  const firstTrade = sortedByDate[0]?.entryDate ?? null;
  const lastTrade = sortedByDate[sortedByDate.length - 1]?.entryDate ?? null;
  const spanMonths =
    firstTrade && lastTrade
      ? Math.max(1, (lastTrade.getTime() - firstTrade.getTime()) / (30.44 * 24 * MS_PER_HOUR))
      : 0;

  const cashTotal = (type: CashFlow["type"]) =>
    cashFlows
      .filter((c) => c.type === type)
      .reduce((acc, c) => acc.plus(c.amount), new Decimal(0))
      .toNumber();
  const deposits = cashTotal("DEPOSIT");
  const withdrawals = cashTotal("WITHDRAWAL");

  const rankedByPnl = [...closed].sort(
    (a, b) => new Decimal(b.pnl).toNumber() - new Decimal(a.pnl).toNumber(),
  );

  const recentNotes = [...active]
    .filter((t) => t.notes && t.notes.trim().length > 0)
    .sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime())
    .slice(0, MAX_NOTES)
    .map((t) => {
      const p = pnlOf(t);
      return {
        asset: t.asset,
        outcome: t.status !== "CLOSED" || !p ? "OPEN" : p.gt(0) ? "WIN" : p.lt(0) ? "LOSS" : "FLAT",
        pnl: p ? round(p.toNumber()) : null,
        note: truncate(t.notes!, NOTE_CHARS),
      };
    });

  return {
    generatedAt: now.toISOString(),
    window: {
      firstTradeDate: firstTrade ? firstTrade.toISOString().slice(0, 10) : null,
      lastTradeDate: lastTrade ? lastTrade.toISOString().slice(0, 10) : null,
      months: round(spanMonths, 1),
    },
    summary: {
      totalTrades: active.length,
      closedTrades: closed.length,
      openTrades: active.length - closed.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      breakEvenTrades: breakEven,
      winRatePct,
      totalPnl: round(totalPnl),
      expectancyPerTrade: closed.length === 0 ? null : round(totalPnl / closed.length),
    },
    winLoss: {
      avgWin: avgWin === null ? null : round(avgWin),
      avgLoss: avgLoss === null ? null : round(avgLoss),
      payoffRatio:
        avgWin === null || avgLoss === null || avgLoss === 0
          ? null
          : round(avgWin / Math.abs(avgLoss), 2),
      avgWinPct: avgRounded(pnlPercents(wins)),
      avgLossPct: avgRounded(pnlPercents(losses)),
      largestWin: wins.length
        ? round(Math.max(...wins.map((t) => new Decimal(t.pnl).toNumber())))
        : null,
      largestLoss: losses.length
        ? round(Math.min(...losses.map((t) => new Decimal(t.pnl).toNumber())))
        : null,
    },
    holdTime: {
      avgHoldHoursWinners: avgWinnerHold === null ? null : round(avgWinnerHold, 1),
      avgHoldHoursLosers: avgLoserHold === null ? null : round(avgLoserHold, 1),
      medianHoldHoursWinners: medianWinnerHold === null ? null : round(medianWinnerHold, 1),
      medianHoldHoursLosers: medianLoserHold === null ? null : round(medianLoserHold, 1),
      loserToWinnerHoldRatio:
        avgWinnerHold === null || avgLoserHold === null || avgWinnerHold === 0
          ? null
          : round(avgLoserHold / avgWinnerHold, 2),
    },
    sizing: {
      avgNotionalWinners: avgRounded(wins.map(notional)),
      avgNotionalLosers: avgRounded(losses.map(notional)),
      largestNotional: closedNotionals.length ? round(Math.max(...closedNotionals)) : null,
      notionalOfLargestLoss: largestLoss ? round(notional(largestLoss)) : null,
      largestLossSizeVsAverage:
        largestLoss && mean(closedNotionals)
          ? round(notional(largestLoss) / mean(closedNotionals)!, 2)
          : null,
    },
    streaks: { maxConsecutiveWins: maxWinStreak, maxConsecutiveLosses: maxLossStreak },
    fees: {
      totalFees: round(totalFees),
      feesAsPctOfGrossPnl: grossPnl === 0 ? null : round((totalFees / Math.abs(grossPnl)) * 100, 1),
    },
    revenge: {
      windowHours: REVENGE_WINDOW_HOURS,
      tradesAfterLoss: revengeTrades.length,
      winRatePct:
        revengeClosed.length === 0 ? null : round((revengeWins / revengeClosed.length) * 100, 1),
      totalPnl: round(sumPnl(revengeClosed)),
      baselineWinRatePct: winRatePct,
    },
    byAssetType: bucketBy(closed, (t) => t.assetType),
    byDirection: bucketBy(closed, (t) => t.direction),
    byTag: bucketBy(closed, (t) => (t.tagNames.length ? t.tagNames : ["(untagged)"]), MAX_TAGS),
    byEntryWeekday: bucketBy(closed, (t) => WEEKDAYS[t.entryDate.getUTCDay()]),
    activity,
    discipline: {
      pctTradesWithNotes:
        active.length === 0
          ? null
          : round(
              (active.filter((t) => t.notes && t.notes.trim().length > 0).length / active.length) *
                100,
              1,
            ),
      pctTradesWithTags:
        active.length === 0
          ? null
          : round((active.filter((t) => t.tagNames.length > 0).length / active.length) * 100, 1),
      avgTradesPerMonth: spanMonths === 0 ? null : round(active.length / spanMonths, 1),
    },
    cash: {
      deposits: round(deposits),
      withdrawals: round(withdrawals),
      dividends: round(cashTotal("DIVIDEND")),
      feeAdjustments: round(cashTotal("FEE_ADJUST")),
      netContributed: round(deposits - Math.abs(withdrawals)),
    },
    extremes: {
      best: rankedByPnl.slice(0, EXTREMES).map(toRef),
      worst: rankedByPnl.slice(-EXTREMES).reverse().map(toRef),
    },
    recentNotes,
  };
}

/** Enough history for a report to be worth generating. */
export const MIN_CLOSED_TRADES = 5;

export function hasEnoughHistory(facts: CoachFacts): boolean {
  return facts.summary.closedTrades >= MIN_CLOSED_TRADES;
}
