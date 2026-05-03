"use client";

import { useEffect, useRef } from "react";
import {
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import type { Candle } from "@/lib/marketdata/candles";

export type ChartMark = {
  time: number; // unix seconds
  price: number;
  kind: "entry" | "exit";
  direction: "LONG" | "SHORT";
  qty?: string;
};

interface TradeChartProps {
  candles: Candle[];
  marks: ChartMark[];
  // Optional horizontal price line, e.g. weighted average entry on a
  // multi-leg position. Rendered as a dashed accent line on the price scale.
  priceLine?: { price: number; label: string } | null;
}

export function TradeChart({ candles, marks, priceLine = null }: TradeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 320,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a1a1aa",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.05)" },
        horzLines: { color: "rgba(148, 163, 184, 0.05)" },
      },
      timeScale: {
        borderColor: "#1f2028",
        timeVisible: false,
        secondsVisible: false,
      },
      rightPriceScale: { borderColor: "#1f2028" },
      crosshair: { mode: CrosshairMode.Normal },
      handleScale: { axisPressedMouseMove: true },
    });
    chartRef.current = chart;

    const series = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    seriesRef.current = series;

    const handleResize = () => {
      if (!container) return;
      chart.applyOptions({ width: container.clientWidth });
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    // lightweight-charts requires strictly ascending, deduplicated time keys.
    const dedup = new Map<number, Candle>();
    for (const c of candles) dedup.set(c.time, c);
    const sorted = [...dedup.values()].sort((a, b) => a.time - b.time);

    series.setData(
      sorted.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    // Snap each mark to the closest candle so arrows never float between
    // bars (which the library silently drops as "no matching time").
    const candleTimes = sorted.map((c) => c.time);
    series.setMarkers(
      marks
        .map((m) => {
          const snapped = nearest(candleTimes, m.time);
          if (snapped == null) return null;
          const isEntry = m.kind === "entry";
          const isLong = m.direction === "LONG";
          return {
            time: snapped as Time,
            position: isEntry ? ("belowBar" as const) : ("aboveBar" as const),
            color: isEntry ? "#5fd0f5" : "#a855f7",
            shape: (isEntry === isLong ? "arrowUp" : "arrowDown") as
              | "arrowUp"
              | "arrowDown",
            text: `${isEntry ? "Entry" : "Exit"} ${formatPrice(m.price)}${
              m.qty ? ` · ${m.qty}` : ""
            }`,
          };
        })
        .filter((m): m is NonNullable<typeof m> => m != null)
        .sort((a, b) => (a.time as number) - (b.time as number)),
    );

    chart.timeScale().fitContent();
  }, [candles, marks]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const created = priceLine
      ? series.createPriceLine({
          price: priceLine.price,
          color: "#5fd0f5",
          lineWidth: 1,
          lineStyle: 2, // dashed
          axisLabelVisible: true,
          title: priceLine.label,
        })
      : null;
    return () => {
      if (created) series.removePriceLine(created);
    };
  }, [priceLine]);

  return <div ref={containerRef} className="w-full" />;
}

function nearest(times: number[], target: number): number | null {
  if (times.length === 0) return null;
  let best = times[0]!;
  let bestDelta = Math.abs(target - best);
  for (let i = 1; i < times.length; i++) {
    const d = Math.abs(target - times[i]!);
    if (d < bestDelta) {
      best = times[i]!;
      bestDelta = d;
    }
  }
  return best;
}

function formatPrice(p: number): string {
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(3);
  return p.toFixed(5);
}
