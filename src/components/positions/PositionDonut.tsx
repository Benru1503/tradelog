"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";

type Slice = {
  asset: string;
  value: number;
  pct: number;
};

// Subtle palette — repeats if there are >8 positions. We deliberately don't
// use the profit/loss greens/reds here; this chart shows allocation, not P&L.
const PALETTE = [
  "#5fd0f5",
  "#7ddcf8",
  "#3aa8c8",
  "#9aa0aa",
  "#c0d8ff",
  "#a78bfa",
  "#f59e0b",
  "#34d399",
];

export function PositionDonut({ slices }: { slices: Slice[] }) {
  if (slices.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-fg-subtle">
        No open positions yet.
      </div>
    );
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="asset"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            stroke="#13141a"
            strokeWidth={2}
          >
            {slices.map((s, i) => (
              <Cell key={s.asset} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#13141a",
              border: "1px solid #1f2028",
              borderRadius: 8,
              fontSize: 12,
              padding: "8px 12px",
            }}
            formatter={(value: number, _name, payload) => {
              const slice = payload?.payload as Slice | undefined;
              if (!slice) return formatCurrency(value);
              return [`${formatCurrency(value)} · ${slice.pct.toFixed(1)}%`, slice.asset];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
