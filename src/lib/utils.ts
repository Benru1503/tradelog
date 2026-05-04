import { clsx, type ClassValue } from "clsx";
import Decimal from "decimal.js";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type DecimalLike = Decimal | string | number | null | undefined;

function toDecimal(value: DecimalLike): Decimal | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

export function formatCurrency(value: DecimalLike, opts?: { signed?: boolean }) {
  const d = toDecimal(value);
  if (!d) return "—";
  const num = d.toNumber();
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
  if (opts?.signed && num > 0) return `+${formatted}`;
  return formatted;
}

export function formatPercent(value: DecimalLike, opts?: { signed?: boolean }) {
  const d = toDecimal(value);
  if (!d) return "—";
  const num = d.toNumber();
  const formatted = `${num.toFixed(2)}%`;
  if (opts?.signed && num > 0) return `+${formatted}`;
  return formatted;
}

export function formatNumber(value: DecimalLike, decimals = 2) {
  const d = toDecimal(value);
  if (!d) return "—";
  return d.toFixed(decimals);
}

/**
 * Compute P&L from trade fields. Returns null if the trade is still open.
 * Formula: (exit - entry) × qty × directionSign − fees
 */
export function calcPnL(input: {
  entryPrice: DecimalLike;
  exitPrice: DecimalLike;
  quantity: DecimalLike;
  fees: DecimalLike;
  direction: "LONG" | "SHORT";
}): { pnl: Decimal; pnlPercent: Decimal } | null {
  const entry = toDecimal(input.entryPrice);
  const exit = toDecimal(input.exitPrice);
  const qty = toDecimal(input.quantity);
  const fees = toDecimal(input.fees) ?? new Decimal(0);
  if (!entry || !exit || !qty) return null;

  const sign = input.direction === "LONG" ? 1 : -1;
  const gross = exit.minus(entry).times(qty).times(sign);
  const pnl = gross.minus(fees);
  const cost = entry.times(qty);
  const pnlPercent = cost.isZero() ? new Decimal(0) : pnl.dividedBy(cost).times(100);

  return { pnl, pnlPercent };
}

export function pnlColorClass(value: DecimalLike) {
  const d = toDecimal(value);
  if (!d) return "text-fg-muted";
  if (d.isZero()) return "text-fg-muted";
  return d.isPositive() ? "text-profit" : "text-loss";
}

export function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatDateTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function toDateInputValue(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
