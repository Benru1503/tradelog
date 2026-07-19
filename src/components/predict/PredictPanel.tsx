"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { AssetType, PredictionHorizon } from "@prisma/client";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { TickerAutocomplete } from "@/components/ui/TickerAutocomplete";
import { cn, formatDate } from "@/lib/utils";
import { runPrediction, type PredictResponse } from "@/app/(app)/predict/actions";

// Plain-data slice of the model metadata, extracted server-side so this
// client bundle never imports the artifact JSONs.
export interface ModelCardData {
  version: string;
  trainedAt: string;
  assets: string[];
  horizons: Record<
    "D1" | "W1",
    { trees: number; testAccuracy: number; testAuc: number; testBaseRate: number; testRows: number }
  >;
  backtest: {
    threshold: number;
    feeBps: number;
    perAsset: Array<{
      asset: string;
      windowFrom: string;
      windowTo: string;
      strategyRetPct: number;
      buyHoldRetPct: number;
      hitRatePct: number | null;
      daysInMarketPct: number;
    }>;
  };
}

export interface HoldingChip {
  asset: string;
  assetType: AssetType;
}

interface Props {
  holdings: HoldingChip[];
  modelCard: ModelCardData;
}

type SuccessResponse = Extract<PredictResponse, { ok: true }>;

function fmtPrice(value: number): string {
  const decimals = value >= 1 ? 2 : 6;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function PredictPanel({ holdings, modelCard }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [assetType, setAssetType] = useState<AssetType>("CRYPTO");
  const [horizon, setHorizon] = useState<PredictionHorizon>("D1");
  // Bumping the key remounts the autocomplete with a new defaultValue when a
  // portfolio chip is clicked (it owns its input state otherwise).
  const [chipValue, setChipValue] = useState<{ asset: string; key: number }>({
    asset: "",
    key: 0,
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<SuccessResponse | null>(null);

  const btcChip: HoldingChip = { asset: "BTC", assetType: "CRYPTO" };
  const chips: HoldingChip[] = [
    btcChip,
    ...holdings.filter((h) => !(h.asset === "BTC" && h.assetType === "CRYPTO")),
  ].slice(0, 8);

  function applyChip(chip: HoldingChip) {
    setAssetType(chip.assetType);
    setChipValue((prev) => ({ asset: chip.asset, key: prev.key + 1 }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("assetType", assetType);
    formData.set("horizon", horizon);
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const res = await runPrediction(formData);
      if (!res.ok) {
        setFormError(res.error);
        if (res.fieldErrors) setErrors(res.fieldErrors);
        setResult(null);
        return;
      }
      setResult(res);
      router.refresh();
    });
  }

  const fieldError = (k: string) => errors[k]?.[0];
  const p = result?.prediction;
  const up = p?.direction === "UP";
  const horizonMeta = modelCard.horizons[horizon];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Direction forecast</CardTitle>
          <span className="text-[11px] text-fg-subtle">
            Experimental ML model · crypto works keyless · not financial advice
          </span>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="rounded-md border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">
            {formError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <Label htmlFor="pr-type">Asset type</Label>
            <Select
              id="pr-type"
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
            <Label htmlFor="pr-asset">Asset</Label>
            <TickerAutocomplete
              key={chipValue.key}
              id="pr-asset"
              name="asset"
              assetType={assetType}
              defaultValue={chipValue.asset}
              required
            />
            {fieldError("asset") && <p className="text-xs text-loss mt-1">{fieldError("asset")}</p>}
          </div>
          <div>
            <Label htmlFor="pr-horizon">Horizon</Label>
            <Select
              id="pr-horizon"
              name="horizon"
              value={horizon}
              onChange={(e) => setHorizon(e.target.value as PredictionHorizon)}
            >
              <option value="D1">Next day</option>
              <option value="W1">Next week</option>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-fg-subtle mr-1">Quick pick:</span>
            {chips.map((chip) => (
              <button
                key={`${chip.asset}:${chip.assetType}`}
                type="button"
                onClick={() => applyChip(chip)}
                className="px-2 py-1 rounded-md border border-border bg-bg-elevated/60 text-xs font-mono hover:border-accent/60 transition-colors"
              >
                {chip.asset}
              </button>
            ))}
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Predicting…" : "Predict"}
          </Button>
        </div>
      </form>

      {p && (
        <div className="mt-6 space-y-4 border-t border-border pt-5">
          <div className="flex items-center gap-4 flex-wrap">
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3",
                up ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss",
              )}
            >
              {up ? <TrendingUp size={28} /> : <TrendingDown size={28} />}
              <div>
                <div className="text-xl font-semibold leading-tight">
                  {up ? "UP" : "DOWN"}
                  <span className="ml-2 font-mono tabular-nums">{p.confidencePct.toFixed(1)}%</span>
                </div>
                <div className="text-[11px] opacity-80">
                  model confidence · {p.horizon === "D1" ? "next day" : "next week"}
                </div>
              </div>
            </div>
            <div className="text-sm text-fg-muted">
              <div>
                <span className="font-mono font-semibold text-fg">{p.symbol}</span>
                <span className="ml-2 text-xs">{p.assetName}</span>
              </div>
              <div className="text-xs mt-0.5">
                Reference close {fmtPrice(p.priceAt)} · as of {formatDate(p.candleDate)}
              </div>
              <div className="text-xs mt-0.5">
                Scores on {formatDate(p.resolvesAt)} · model v{p.modelVersion}
              </div>
            </div>
          </div>

          {p.deduped && (
            <p className="text-xs text-fg-subtle">
              You already ran this one today — showing the existing prediction.
            </p>
          )}

          <details className="rounded-lg border border-border/60 px-3 py-2 text-sm">
            <summary className="cursor-pointer text-fg-muted select-none">About this model</summary>
            <div className="mt-3 space-y-3 text-xs text-fg-muted">
              <p>
                Gradient-boosted trees (XGBoost, {horizonMeta.trees} trees) over{" "}
                {modelCard.assets.length} assets of daily history since 2020, scored on price-action
                features only. Trained {formatDate(modelCard.trainedAt)}.
              </p>
              <p>
                Out-of-sample ({horizonMeta.testRows.toLocaleString()} rows): accuracy{" "}
                {(horizonMeta.testAccuracy * 100).toFixed(1)}% vs a{" "}
                {(horizonMeta.testBaseRate * 100).toFixed(1)}% always-up baseline · AUC{" "}
                {horizonMeta.testAuc.toFixed(3)}. Barely better than a coin flip — that is the
                honest state of daily direction forecasting.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="text-fg-subtle">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Backtest (next-day)</th>
                      <th className="py-1 pr-3 font-medium text-right">Strategy</th>
                      <th className="py-1 pr-3 font-medium text-right">Buy & hold</th>
                      <th className="py-1 pr-3 font-medium text-right">Hit rate</th>
                      <th className="py-1 font-medium text-right">In market</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums">
                    {modelCard.backtest.perAsset.map((b) => (
                      <tr key={b.asset} className="border-t border-border/40">
                        <td className="py-1 pr-3 font-sans">{b.asset}</td>
                        <td
                          className={cn(
                            "py-1 pr-3 text-right",
                            b.strategyRetPct >= 0 ? "text-profit" : "text-loss",
                          )}
                        >
                          {b.strategyRetPct >= 0 ? "+" : ""}
                          {b.strategyRetPct.toFixed(1)}%
                        </td>
                        <td className="py-1 pr-3 text-right">
                          {b.buyHoldRetPct >= 0 ? "+" : ""}
                          {b.buyHoldRetPct.toFixed(1)}%
                        </td>
                        <td className="py-1 pr-3 text-right">
                          {b.hitRatePct === null ? "—" : `${b.hitRatePct.toFixed(0)}%`}
                        </td>
                        <td className="py-1 text-right">{b.daysInMarketPct.toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                Backtest: long when p(up) ≥ {modelCard.backtest.threshold}, flat otherwise,{" "}
                {modelCard.backtest.feeBps} bps fee per position change, on the held-out window.
                Past performance predicts nothing. This is a study tool, not advice.
              </p>
            </div>
          </details>
        </div>
      )}
    </Card>
  );
}
