"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Area, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import type { AssetType } from "@prisma/client";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { TickerAutocomplete } from "@/components/ui/TickerAutocomplete";
import { formatCurrency, formatPercent, pnlColorClass } from "@/lib/utils";
import { runDca, saveDcaSnapshot, type DcaResponse } from "@/app/(app)/playground/actions";

function defaultFromDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type SuccessResponse = Extract<DcaResponse, { ok: true }>;

export function DcaPanel() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [savingSnapshot, startSaving] = useTransition();
  const [assetType, setAssetType] = useState<AssetType>("CRYPTO");
  const [endToday, setEndToday] = useState(true);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<SuccessResponse | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("assetType", assetType);
    if (endToday) formData.set("to", "");
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const res = await runDca(formData);
      if (!res.ok) {
        setFormError(res.error);
        if (res.fieldErrors) setErrors(res.fieldErrors);
        setResult(null);
        return;
      }
      setResult(res);
    });
  }

  function handleSave() {
    if (!result) return;
    startSaving(async () => {
      const res = await saveDcaSnapshot(result.params, result.result, result.assetName);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Snapshot saved");
      router.refresh();
    });
  }

  const fieldError = (k: string) => errors[k]?.[0];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Dollar-cost average</CardTitle>
          <span className="text-[11px] text-fg-subtle">
            Crypto works keyless · stocks/forex need a paid Finnhub tier
          </span>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="rounded-md border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">
            {formError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="dca-type">Asset type</Label>
            <Select
              id="dca-type"
              name="assetType"
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as AssetType)}
            >
              <option value="CRYPTO">Crypto</option>
              <option value="STOCK">Stock</option>
              <option value="FOREX">Forex</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="dca-asset">Asset</Label>
            <TickerAutocomplete id="dca-asset" name="asset" assetType={assetType} required />
            {fieldError("asset") && <p className="text-xs text-loss mt-1">{fieldError("asset")}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <Label htmlFor="dca-amount">Amount (USD)</Label>
            <Input
              id="dca-amount"
              name="amount"
              type="number"
              step="any"
              min="0"
              defaultValue="100"
              required
            />
            {fieldError("amount") && (
              <p className="text-xs text-loss mt-1">{fieldError("amount")}</p>
            )}
          </div>
          <div>
            <Label htmlFor="dca-cadence">Every</Label>
            <Select id="dca-cadence" name="cadence" defaultValue="MONTHLY">
              <option value="WEEKLY">Week</option>
              <option value="MONTHLY">Month</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="dca-from">From</Label>
            <Input
              id="dca-from"
              name="from"
              type="date"
              defaultValue={defaultFromDate()}
              max={todayISO()}
              required
            />
            {fieldError("from") && <p className="text-xs text-loss mt-1">{fieldError("from")}</p>}
          </div>
          <div>
            <Label htmlFor="dca-to">To</Label>
            <Input
              id="dca-to"
              name="to"
              type="date"
              defaultValue={todayISO()}
              max={todayISO()}
              disabled={endToday}
            />
            <label className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-fg-muted">
              <input
                type="checkbox"
                checked={endToday}
                onChange={(e) => setEndToday(e.target.checked)}
                className="accent-accent"
              />
              Use today
            </label>
            {fieldError("to") && <p className="text-xs text-loss mt-1">{fieldError("to")}</p>}
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Running…" : "Run scenario"}
          </Button>
        </div>
      </form>

      {result && (
        <div className="mt-6 space-y-4 border-t border-border pt-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat
              label="Invested"
              value={formatCurrency(result.result.totalInvested)}
              sub={`${result.result.contributions.length} buys`}
            />
            <Stat label="Value" value={formatCurrency(result.result.finalValue)} />
            <Stat
              label="P&L"
              value={formatCurrency(result.result.pnl, { signed: true })}
              sub={formatPercent(result.result.pnlPct, { signed: true })}
              colorClass={pnlColorClass(result.result.pnl)}
            />
            <Stat
              label="CAGR"
              value={
                result.result.cagrPct == null
                  ? "—"
                  : formatPercent(result.result.cagrPct, { signed: true })
              }
              colorClass={
                result.result.cagrPct == null
                  ? "text-fg-muted"
                  : pnlColorClass(result.result.cagrPct)
              }
            />
          </div>

          <div className="rounded-xl border border-border/60 overflow-hidden bg-bg-elevated/30 p-3">
            <DcaChart series={result.result.series} />
            <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-fg-subtle">
              <LegendDot color="#5fd0f5" /> Portfolio value
              <LegendDot color="#a1a1aa" /> Total invested
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-fg-subtle">
              {result.params.asset} · {result.assetName}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSave}
              disabled={savingSnapshot}
            >
              {savingSnapshot ? "Saving…" : "Save snapshot"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function DcaChart({ series }: { series: { time: number; invested: number; value: number }[] }) {
  if (series.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-sm text-fg-subtle">
        No data points in range.
      </div>
    );
  }
  const data = series.map((p) => ({
    date: new Date(p.time * 1000).toISOString(),
    invested: p.invested,
    value: p.value,
  }));
  return (
    <div className="h-72 -mx-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="dcaValueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5fd0f5" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#5fd0f5" stopOpacity={0} />
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
            formatter={(val: number, name: string) => [
              formatCurrency(val),
              name === "value" ? "Value" : "Invested",
            ]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#5fd0f5"
            strokeWidth={2}
            fill="url(#dcaValueFill)"
            isAnimationActive={false}
          />
          <Line
            type="stepAfter"
            dataKey="invested"
            stroke="#a1a1aa"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function LegendDot({ color }: { color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

function Stat({
  label,
  value,
  sub,
  colorClass,
}: {
  label: string;
  value: string;
  sub?: string;
  colorClass?: string;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-fg-subtle mb-1">{label}</div>
      <div className={`text-lg font-mono font-semibold tabular-nums ${colorClass ?? ""}`}>
        {value}
      </div>
      {sub && (
        <div className={`text-xs font-mono tabular-nums ${colorClass ?? "text-fg-muted"}`}>
          {sub}
        </div>
      )}
    </div>
  );
}
