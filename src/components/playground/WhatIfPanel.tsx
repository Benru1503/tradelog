"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AssetType } from "@prisma/client";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { TickerAutocomplete } from "@/components/ui/TickerAutocomplete";
import { formatCurrency, formatNumber, formatPercent, pnlColorClass } from "@/lib/utils";
import { runWhatIf, saveWhatIfSnapshot, type WhatIfResponse } from "@/app/(app)/playground/actions";
import type { ChartMark } from "@/components/trades/TradeChart";

const TradeChart = dynamic(
  () => import("@/components/trades/TradeChart").then((m) => m.TradeChart),
  { loading: () => <div className="h-80 animate-pulse bg-bg-elevated/40 rounded" /> },
);

function defaultBuyDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type SuccessResponse = Extract<WhatIfResponse, { ok: true }>;

export function WhatIfPanel() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [savingSnapshot, startSaving] = useTransition();
  const [assetType, setAssetType] = useState<AssetType>("CRYPTO");
  const [sellToday, setSellToday] = useState(true);
  const [buyDate, setBuyDate] = useState(defaultBuyDate());
  const [sellDate, setSellDate] = useState(todayISO());
  // Earliest date this symbol has history for (null = unrestricted, e.g.
  // crypto or before a ticker's been picked). Caps the date-picker inputs so
  // users can't pick, say, 1800 for a stock that IPO'd decades later.
  const [minDate, setMinDate] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<SuccessResponse | null>(null);

  function handleAssetTypeChange(next: AssetType) {
    setAssetType(next);
    // Stale from the previous symbol — refreshed on the next ticker pick.
    setMinDate(null);
  }

  async function handleTickerSelect(hit: { symbol: string; assetType: AssetType }) {
    if (hit.assetType === "CRYPTO") {
      setMinDate(null);
      return;
    }
    try {
      const params = new URLSearchParams({ symbol: hit.symbol, assetType: hit.assetType });
      const res = await fetch(`/api/tickers/first-trade-date?${params.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; firstTradeDate: string | null };
      if (!data.ok) return;
      setMinDate(data.firstTradeDate);
      const floor = data.firstTradeDate;
      if (floor) {
        setBuyDate((d) => (d < floor ? floor : d));
        setSellDate((d) => (d < floor ? floor : d));
      }
    } catch {
      // Network hiccup — leave the picker unrestricted rather than block the form.
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("assetType", assetType);
    if (sellToday) formData.set("sellDate", "");
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const res = await runWhatIf(formData);
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
      const res = await saveWhatIfSnapshot(result.params, result.result, result.assetName);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Snapshot saved");
      router.refresh();
    });
  }

  const fieldError = (k: string) => errors[k]?.[0];

  const marks: ChartMark[] = result
    ? [
        {
          time: result.result.buyTime,
          price: result.result.buyPrice,
          kind: "entry",
          direction: "LONG",
        },
        {
          time: result.result.sellTime,
          price: result.result.sellPrice,
          kind: "exit",
          direction: "LONG",
        },
      ]
    : [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>What if</CardTitle>
          <span className="text-[11px] text-fg-subtle">
            Crypto, stocks & forex all work keyless
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
            <Label htmlFor="wi-type">Asset type</Label>
            <Select
              id="wi-type"
              name="assetType"
              value={assetType}
              onChange={(e) => handleAssetTypeChange(e.target.value as AssetType)}
            >
              <option value="CRYPTO">Crypto</option>
              <option value="STOCK">Stock</option>
              <option value="FOREX">Forex</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="wi-asset">Asset</Label>
            <TickerAutocomplete
              id="wi-asset"
              name="asset"
              assetType={assetType}
              required
              onSelect={handleTickerSelect}
            />
            {fieldError("asset") && <p className="text-xs text-loss mt-1">{fieldError("asset")}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="wi-amount">Buy amount (USD)</Label>
            <Input
              id="wi-amount"
              name="buyAmount"
              type="number"
              step="any"
              min="0"
              defaultValue="10000"
              required
            />
            {fieldError("buyAmount") && (
              <p className="text-xs text-loss mt-1">{fieldError("buyAmount")}</p>
            )}
          </div>
          <div>
            <Label htmlFor="wi-buy-date">Buy date</Label>
            <Input
              id="wi-buy-date"
              name="buyDate"
              type="date"
              value={buyDate}
              onChange={(e) => setBuyDate(e.target.value)}
              min={minDate ?? undefined}
              max={todayISO()}
              required
            />
            {fieldError("buyDate") && (
              <p className="text-xs text-loss mt-1">{fieldError("buyDate")}</p>
            )}
          </div>
          <div>
            <Label htmlFor="wi-sell-date">Sell date</Label>
            <div className="flex items-center gap-2">
              <Input
                id="wi-sell-date"
                name="sellDate"
                type="date"
                value={sellDate}
                onChange={(e) => setSellDate(e.target.value)}
                min={minDate ?? undefined}
                max={todayISO()}
                disabled={sellToday}
              />
            </div>
            <label className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-fg-muted">
              <input
                type="checkbox"
                checked={sellToday}
                onChange={(e) => setSellToday(e.target.checked)}
                className="accent-accent"
              />
              Use today
            </label>
            {fieldError("sellDate") && (
              <p className="text-xs text-loss mt-1">{fieldError("sellDate")}</p>
            )}
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
            <Stat label="Buy price" value={formatCurrency(result.result.buyPrice)} />
            <Stat label="Sell price" value={formatCurrency(result.result.sellPrice)} />
            <Stat
              label="Shares"
              value={formatNumber(result.result.shares, sharesDecimals(result.result.shares))}
            />
            <Stat
              label="Result"
              value={formatCurrency(result.result.pnl, { signed: true })}
              sub={formatPercent(result.result.pnlPct, { signed: true })}
              colorClass={pnlColorClass(result.result.pnl)}
            />
          </div>

          <div className="rounded-xl border border-border/60 overflow-hidden">
            <TradeChart candles={result.candles} marks={marks} />
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

function sharesDecimals(n: number): number {
  if (n >= 100) return 2;
  if (n >= 1) return 4;
  return 6;
}
