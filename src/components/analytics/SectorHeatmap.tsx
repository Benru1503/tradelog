"use client";

import Link from "next/link";
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import { formatCurrency } from "@/lib/utils";

export interface HeatmapTile {
  positionId: string;
  asset: string;
  sector: string;
  // Sized by absolute capital allocated (market value if available, else
  // cost basis). Always positive — the negative case (a SHORT eating into
  // your account) still occupies allocation space.
  size: number;
  // Color intensity is keyed off this. null means "no live price yet".
  unrealizedPct: number | null;
}

interface Props {
  tiles: HeatmapTile[];
}

// Recharts' Treemap likes a tree shape: parents (sectors) with children
// (positions). Pre-aggregate so every leaf has a stable parent.
type TreeNode = {
  name: string;
  children: Array<HeatmapTile & { name: string }>;
};

export function SectorHeatmap({ tiles }: Props) {
  if (tiles.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-fg-subtle">
        No open positions to allocate.
      </div>
    );
  }

  const bySector = new Map<string, TreeNode>();
  for (const t of tiles) {
    let node = bySector.get(t.sector);
    if (!node) {
      node = { name: t.sector, children: [] };
      bySector.set(t.sector, node);
    }
    node.children.push({ ...t, name: t.asset });
  }
  const data = Array.from(bySector.values()).sort(
    (a, b) =>
      b.children.reduce((s, c) => s + c.size, 0) - a.children.reduce((s, c) => s + c.size, 0),
  );

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={data}
          dataKey="size"
          aspectRatio={4 / 3}
          stroke="#13141a"
          isAnimationActive={false}
          content={<TileContent />}
        >
          <Tooltip cursor={false} content={<HeatmapTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}

// Recharts hands us a node payload with x/y/width/height plus our custom
// fields. We render a colored rect with the asset symbol and its P&L %,
// wrapped in a Link so clicking drills into the position.
type RechartsTileProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  depth?: number;
  name?: string;
  // Recharts forwards arbitrary leaf fields:
  positionId?: string;
  asset?: string;
  sector?: string;
  unrealizedPct?: number | null;
};

function TileContent(props: RechartsTileProps) {
  const { x = 0, y = 0, width = 0, height = 0, depth = 0 } = props;

  // Sector parent: render only the label, no fill — the children paint.
  if (depth === 0) {
    return width > 80 && height > 22 ? (
      <text
        x={x + 6}
        y={y + 14}
        fill="#a1a1aa"
        fontSize={10}
        fontWeight={500}
        style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
      >
        {props.name}
      </text>
    ) : null;
  }

  const fill = colorFor(props.unrealizedPct ?? null);
  const showText = width > 50 && height > 30;
  const showPct = width > 64 && height > 44;

  const tile = (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="#13141a"
        strokeWidth={1}
      />
      {showText && (
        <text
          x={x + width / 2}
          y={y + height / 2 + (showPct ? -4 : 4)}
          textAnchor="middle"
          fill="#f4f4f5"
          fontSize={Math.min(13, Math.max(10, width / 8))}
          fontWeight={600}
        >
          {props.asset}
        </text>
      )}
      {showPct && props.unrealizedPct != null && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 12}
          textAnchor="middle"
          fill="#f4f4f5"
          fontSize={11}
          opacity={0.85}
        >
          {props.unrealizedPct > 0 ? "+" : ""}
          {props.unrealizedPct.toFixed(1)}%
        </text>
      )}
    </g>
  );

  return props.positionId ? <Link href={`/positions/${props.positionId}`}>{tile}</Link> : tile;
}

function colorFor(pct: number | null): string {
  // Pending live price — neutral gray.
  if (pct == null) return "#2c2d37";
  // Clamp to ±10% for color intensity. Beyond that we just hit the cap.
  const clamped = Math.max(-10, Math.min(10, pct));
  const alpha = Math.abs(clamped) / 10;
  if (clamped >= 0) {
    // Green: blend toward #22c55e
    const r = Math.round(31 + (34 - 31) * alpha);
    const g = Math.round(33 + (197 - 33) * alpha);
    const b = Math.round(40 + (94 - 40) * alpha);
    return `rgb(${r}, ${g}, ${b})`;
  }
  // Red: blend toward #ef4444
  const r = Math.round(31 + (239 - 31) * alpha);
  const g = Math.round(33 + (68 - 33) * alpha);
  const b = Math.round(40 + (68 - 40) * alpha);
  return `rgb(${r}, ${g}, ${b})`;
}

type TooltipPayload = {
  active?: boolean;
  payload?: Array<{ payload: HeatmapTile & { name?: string } }>;
};

function HeatmapTooltip({ active, payload }: TooltipPayload) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p?.asset) return null;
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
      <div className="font-semibold">{p.asset}</div>
      <div className="text-fg-muted text-[11px]">{p.sector}</div>
      <div className="mt-1 flex items-center justify-between gap-4">
        <span className="text-fg-muted">Allocation</span>
        <span className="font-mono">{formatCurrency(p.size)}</span>
      </div>
      {p.unrealizedPct != null && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-fg-muted">Unrealized</span>
          <span
            className="font-mono"
            style={{ color: p.unrealizedPct >= 0 ? "#22c55e" : "#ef4444" }}
          >
            {p.unrealizedPct > 0 ? "+" : ""}
            {p.unrealizedPct.toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  );
}
