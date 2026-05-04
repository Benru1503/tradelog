import Decimal from "decimal.js";
import type { Trade, CashFlow } from "@prisma/client";

// ────────────────────────────────────────────────────────────────────────────
// Portfolio math: TWR / MWR / value series.
//
// Why this exists: the original equity curve treated trade P&L as the only
// thing that moves the line. Once we model cash flows (deposits / withdrawals),
// a $1k deposit would visually look indistinguishable from a $1k trading gain
// — which is the bug TWR fixes. See spec § 3 in
// /Users/Ben_Rubinovitz/.claude/plans/hidden-gathering-kite.md
// ────────────────────────────────────────────────────────────────────────────

interface TimelineEvent {
  date: Date;
  // Trade P&L realized at exit. Positive on a winner, negative on a loser.
  pnl?: Decimal;
  // Signed cash flow. Deposits/dividends positive; withdrawals/fee_adjusts
  // negative (handled in `signedFlow` below).
  flow?: Decimal;
}

function signedFlow(cf: CashFlow): Decimal {
  const amt = new Decimal(cf.amount.toString());
  switch (cf.type) {
    case "DEPOSIT":
    case "DIVIDEND":
      return amt;
    case "WITHDRAWAL":
    case "FEE_ADJUST":
      return amt.neg();
    default:
      return amt;
  }
}

function buildTimeline(trades: Trade[], flows: CashFlow[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const t of trades) {
    if (t.status === "CLOSED" && t.pnl != null && t.exitDate) {
      events.push({ date: t.exitDate, pnl: new Decimal(t.pnl.toString()) });
    }
  }
  for (const f of flows) {
    events.push({ date: f.occurredAt, flow: signedFlow(f) });
  }
  // Cash flows on the same instant as a trade get applied AFTER the trade —
  // their effect (deposit) doesn't retroactively change the trade's sub-period.
  events.sort((a, b) => {
    const t = a.date.getTime() - b.date.getTime();
    if (t !== 0) return t;
    return (a.flow ? 1 : 0) - (b.flow ? 1 : 0);
  });
  return events;
}

// Time-Weighted Return — the trading-only return %. Cash flows neutralize the
// sub-period boundaries; they don't count as gains.
//
// Returns 0 if there's never been any capital (no deposits) — there is no
// "return" to compute.
export function computeTWR(trades: Trade[], flows: CashFlow[]): number {
  const events = buildTimeline(trades, flows);
  let value = new Decimal(0);
  let periodStart = new Decimal(0);
  let factor = new Decimal(1);
  let everHadCapital = false;

  for (const e of events) {
    if (e.pnl) {
      value = value.plus(e.pnl);
    } else if (e.flow) {
      if (periodStart.gt(0)) {
        factor = factor.times(value.dividedBy(periodStart));
      }
      value = value.plus(e.flow);
      periodStart = value;
      if (value.gt(0)) everHadCapital = true;
    }
  }

  if (periodStart.gt(0)) {
    factor = factor.times(value.dividedBy(periodStart));
  }

  if (!everHadCapital) return 0;
  return factor.minus(1).toNumber();
}

// Money-Weighted Return (XIRR-style). Solves for the rate that makes net
// present value of all cash movements zero, treating the *current* account
// value as the final cash flow returned to the investor.
//
// Implementation: bisection on (-0.99, 10). Good enough for portfolio reporting.
export function computeMWR(trades: Trade[], flows: CashFlow[]): number {
  const events = buildTimeline(trades, flows);
  if (events.length === 0) return 0;

  // Convert into (date, signedAmount) tuples from the *investor's* perspective.
  // Deposits = -1 (money out of pocket), withdrawals = +1 (money received),
  // final value = +1 (money still owed back to investor).
  const tuples: Array<{ t: number; amt: Decimal }> = [];
  let runningValue = new Decimal(0);
  const t0 = events[0]!.date.getTime();

  for (const e of events) {
    const tDays = (e.date.getTime() - t0) / 86_400_000;
    if (e.pnl) {
      runningValue = runningValue.plus(e.pnl);
    } else if (e.flow) {
      tuples.push({ t: tDays, amt: e.flow.neg() });
      runningValue = runningValue.plus(e.flow);
    }
  }
  // Final account value, dated at the last event.
  const tLast = (events[events.length - 1]!.date.getTime() - t0) / 86_400_000;
  if (runningValue.gt(0)) {
    tuples.push({ t: tLast, amt: runningValue });
  }

  if (tuples.length < 2) return 0;

  const npv = (r: number) =>
    tuples.reduce((acc, x) => acc + x.amt.toNumber() / Math.pow(1 + r, x.t / 365), 0);

  // Bisection.
  let lo = -0.99;
  let hi = 10;
  let fLo = npv(lo);
  let fHi = npv(hi);
  if (Number.isNaN(fLo) || Number.isNaN(fHi)) return 0;
  if (fLo * fHi > 0) return 0;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

// Series for the equity-curve "Trading P&L" mode: cumulative trading P&L
// only. Cash flows do not move the line.
export type SeriesPoint = { date: string; value: number };

export function computeTradingPnlSeries(trades: Trade[]): SeriesPoint[] {
  const closed = trades
    .filter((t) => t.status === "CLOSED" && t.pnl != null && t.exitDate != null)
    .sort((a, b) => a.exitDate!.getTime() - b.exitDate!.getTime());
  let running = new Decimal(0);
  return closed.map((t) => {
    running = running.plus(t.pnl!.toString());
    return { date: t.exitDate!.toISOString(), value: running.toNumber() };
  });
}

// Series for "Account Value" mode: running balance including cash flows.
// Deposit days lift the line; withdrawal days drop it.
export function computeAccountValueSeries(trades: Trade[], flows: CashFlow[]): SeriesPoint[] {
  const events = buildTimeline(trades, flows);
  let value = new Decimal(0);
  return events.map((e) => {
    if (e.pnl) value = value.plus(e.pnl);
    if (e.flow) value = value.plus(e.flow);
    return { date: e.date.toISOString(), value: value.toNumber() };
  });
}

// Unified series for the dashboard equity card: every event timestamp gets
// BOTH a trading-pnl total and an account-value total, plus an optional
// flow marker. Lets the chart show one mode's line while the tooltip always
// reports both numbers — and gives marker positions for deposit/withdrawal
// dots in account-value mode.
export type DashboardPoint = {
  date: string;
  tradingPnl: number;
  accountValue: number;
  flow?: { type: CashFlow["type"]; amount: number };
};

export function computeDashboardSeries(trades: Trade[], flows: CashFlow[]): DashboardPoint[] {
  const events = buildTimeline(trades, flows);
  let pnl = new Decimal(0);
  let acct = new Decimal(0);
  const flowByDate = new Map<number, CashFlow>();
  for (const f of flows) flowByDate.set(f.occurredAt.getTime(), f);

  return events.map((e) => {
    if (e.pnl) {
      pnl = pnl.plus(e.pnl);
      acct = acct.plus(e.pnl);
    }
    if (e.flow) acct = acct.plus(e.flow);
    const point: DashboardPoint = {
      date: e.date.toISOString(),
      tradingPnl: pnl.toNumber(),
      accountValue: acct.toNumber(),
    };
    if (e.flow) {
      const f = flowByDate.get(e.date.getTime());
      if (f) point.flow = { type: f.type, amount: e.flow.toNumber() };
    }
    return point;
  });
}

// Convenience: cash on hand right now (sum of signed cash flows minus capital
// currently tied up in open positions). The caller passes the open-position
// cost basis since this lib doesn't fetch from the DB itself.
export function computeCashOnHand(
  flows: CashFlow[],
  openPositionsCostBasis: Decimal | number = 0,
): number {
  const flowsTotal = flows.reduce((acc, f) => acc.plus(signedFlow(f)), new Decimal(0));
  // Realized P&L from closed trades has already settled into cash.
  const tied = new Decimal(openPositionsCostBasis.toString());
  return flowsTotal.minus(tied).toNumber();
}
