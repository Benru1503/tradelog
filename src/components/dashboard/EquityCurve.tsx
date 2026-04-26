"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import type { EquityPoint } from "@/lib/stats";
import { formatCurrency } from "@/lib/utils";

export function EquityCurve({ data }: { data: EquityPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-fg-subtle">
        Close some trades to see your equity curve.
      </div>
    );
  }

  const isPositive = data[data.length - 1].equity >= 0;
  const stroke = isPositive ? "#10b981" : "#ef4444";

  return (
    <div className="h-64 -mx-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.3} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#71717a" }}
            tickFormatter={(v) => format(new Date(v), "MMM d")}
            stroke="#26262d"
            minTickGap={32}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#71717a" }}
            tickFormatter={(v) => `$${Math.round(v).toLocaleString()}`}
            stroke="#26262d"
            width={64}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#16161a",
              border: "1px solid #26262d",
              borderRadius: 6,
              fontSize: 12,
            }}
            labelFormatter={(v) => format(new Date(v as string), "MMM d, yyyy")}
            formatter={(v: number) => [formatCurrency(v, { signed: true }), "Equity"]}
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke={stroke}
            strokeWidth={2}
            fill="url(#equityFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
