import Decimal from "decimal.js";
import type { Trade } from "@prisma/client";

export type Stats = {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  winRate: number;
  totalPnl: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
};

export function computeStats(trades: Trade[]): Stats {
  const closed = trades.filter((t) => t.status === "CLOSED" && t.pnl != null);
  const wins = closed.filter((t) => new Decimal(t.pnl!).isPositive());
  const losses = closed.filter((t) => new Decimal(t.pnl!).isNegative());

  const sum = (xs: Trade[]) =>
    xs.reduce((acc, t) => acc.plus(t.pnl ?? 0), new Decimal(0));

  const totalPnl = sum(closed).toNumber();
  const winRate = closed.length === 0 ? 0 : (wins.length / closed.length) * 100;
  const avgWin = wins.length === 0 ? 0 : sum(wins).dividedBy(wins.length).toNumber();
  const avgLoss =
    losses.length === 0 ? 0 : sum(losses).dividedBy(losses.length).toNumber();

  const pnls = closed.map((t) => new Decimal(t.pnl!).toNumber());
  const bestTrade = pnls.length ? Math.max(...pnls) : 0;
  const worstTrade = pnls.length ? Math.min(...pnls) : 0;

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    openTrades: trades.length - closed.length,
    winRate,
    totalPnl,
    avgWin,
    avgLoss,
    bestTrade,
    worstTrade,
  };
}

export type EquityPoint = { date: string; equity: number };

export function computeEquityCurve(trades: Trade[]): EquityPoint[] {
  const closed = trades
    .filter((t) => t.status === "CLOSED" && t.pnl != null && t.exitDate != null)
    .sort((a, b) => a.exitDate!.getTime() - b.exitDate!.getTime());

  let running = new Decimal(0);
  return closed.map((t) => {
    running = running.plus(t.pnl ?? 0);
    return {
      date: t.exitDate!.toISOString(),
      equity: running.toNumber(),
    };
  });
}
