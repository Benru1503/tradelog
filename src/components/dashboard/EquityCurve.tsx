"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import type { DashboardPoint } from "@/lib/portfolio";
import { cn, formatCurrency } from "@/lib/utils";

type Mode = "TRADING" | "ACCOUNT";
type Timeframe = "ALL" | "YTD" | "1M" | "1W";

const TIMEFRAMES: { id: Timeframe; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "YTD", label: "YTD" },
  { id: "1M", label: "1M" },
  { id: "1W", label: "1W" },
];

function cutoffFor(tf: Timeframe): number | null {
  const now = new Date();
  if (tf === "ALL") return null;
  if (tf === "YTD") return new Date(now.getFullYear(), 0, 1).getTime();
  if (tf === "1M") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return d.getTime();
  }
  // 1W
  const d = new Date(now);
  d.setDate(d.getDate() - 7);
  return d.getTime();
}

export function EquityCurve({ data }: { data: DashboardPoint[] }) {
  const [mode, setMode] = useState<Mode>("TRADING");
  const [tf, setTf] = useState<Timeframe>("ALL");

  const filtered = useMemo(() => {
    const cutoff = cutoffFor(tf);
    if (cutoff == null) return data;
    return data.filter((p) => new Date(p.date).getTime() >= cutoff);
  }, [data, tf]);

  if (data.length === 0) {
    return (
      <div className="px-5 pb-5">
        <Toggles mode={mode} setMode={setMode} tf={tf} setTf={setTf} />
        <div className="h-72 flex items-center justify-center text-sm text-fg-subtle">
          Close some trades to see your equity curve.
        </div>
      </div>
    );
  }

  const dataKey: keyof DashboardPoint = mode === "TRADING" ? "tradingPnl" : "accountValue";
  const last = (filtered[filtered.length - 1]?.[dataKey] as number) ?? 0;
  const stroke = last >= 0 ? "#22c55e" : "#ef4444";

  return (
    <div className="px-5 pb-5">
      <Toggles mode={mode} setMode={setMode} tf={tf} setTf={setTf} />
      <div className="h-72 -mx-2">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-fg-subtle">
            No activity in this range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filtered} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} height={0} />
              <YAxis tick={false} axisLine={false} tickLine={false} width={0} />
              <Tooltip
                cursor={{ stroke: "#2c2d37", strokeWidth: 1 }}
                contentStyle={{
                  backgroundColor: "#13141a",
                  border: "1px solid #1f2028",
                  borderRadius: 8,
                  fontSize: 12,
                  padding: "8px 12px",
                }}
                labelFormatter={(v) => format(new Date(v as string), "MMM d, yyyy")}
                content={<DualTooltip />}
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={stroke}
                strokeWidth={2.5}
                fill="url(#equityFill)"
                isAnimationActive={false}
              />
              {mode === "ACCOUNT" &&
                filtered
                  .map((p, i) => ({ p, i }))
                  .filter(({ p }) => p.flow)
                  .map(({ p, i }) => (
                    <ReferenceDot
                      key={i}
                      x={p.date}
                      y={p.accountValue}
                      r={4}
                      fill={p.flow!.amount >= 0 ? "#22c55e" : "#ef4444"}
                      stroke="#13141a"
                      strokeWidth={2}
                      isFront
                    />
                  ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function Toggles({
  mode,
  setMode,
  tf,
  setTf,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  tf: Timeframe;
  setTf: (t: Timeframe) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Pill active={mode === "TRADING"} onClick={() => setMode("TRADING")}>
        Trading P&amp;L
      </Pill>
      <Pill active={mode === "ACCOUNT"} onClick={() => setMode("ACCOUNT")}>
        Account Value
      </Pill>
      <span className="mx-1 h-4 w-px bg-border" aria-hidden />
      {TIMEFRAMES.map((t) => (
        <Pill key={t.id} active={tf === t.id} onClick={() => setTf(t.id)}>
          {t.label}
        </Pill>
      ))}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 px-3 rounded-full text-xs font-medium transition-colors",
        active
          ? "bg-accent text-bg"
          : "bg-bg-elevated/60 text-fg-muted ring-1 ring-inset ring-border hover:text-fg hover:ring-border-strong",
      )}
    >
      {children}
    </button>
  );
}

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: DashboardPoint }>;
  label?: string;
};

function DualTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  return (
    <div
      style={{
        backgroundColor: "#13141a",
        border: "1px solid #1f2028",
        borderRadius: 8,
        fontSize: 12,
        padding: "8px 12px",
      }}
    >
      <div className="text-fg-subtle mb-1">
        {label ? format(new Date(label), "MMM d, yyyy") : ""}
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-fg-muted">Trading P&amp;L</span>
        <span className="font-mono tabular-nums">
          {formatCurrency(p.tradingPnl, { signed: true })}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-fg-muted">Account value</span>
        <span className="font-mono tabular-nums">{formatCurrency(p.accountValue)}</span>
      </div>
      {p.flow && (
        <div className="mt-1.5 pt-1.5 border-t border-border text-[11px] text-fg-subtle">
          {p.flow.amount >= 0 ? "▲" : "▼"} {p.flow.type.toLowerCase()}{" "}
          <span className="font-mono">{formatCurrency(Math.abs(p.flow.amount))}</span>
        </div>
      )}
    </div>
  );
}
