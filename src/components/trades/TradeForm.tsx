"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Trade, AssetType, Direction, Tag } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { TickerAutocomplete } from "@/components/ui/TickerAutocomplete";
import { TagPicker } from "@/components/tags/TagPicker";
import { AveragingPreviewModal } from "@/components/positions/AveragingPreviewModal";
import { createTrade, updateTrade, type ActionResult } from "@/app/(app)/trades/actions";
import { toDateInputValue } from "@/lib/utils";

function toLocalDateInput(date: Date | string | null) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return toDateInputValue(d);
}

export interface OpenPositionLite {
  id: string;
  asset: string;
  assetType: AssetType;
  direction: Direction;
  totalQty: string;
  avgCost: string;
}

interface FormDefaults {
  asset?: string;
  assetType?: AssetType;
  direction?: Direction;
}

export function TradeForm({
  trade,
  openPositions = [],
  defaults,
  tags = [],
  selectedTagIds = [],
}: {
  trade?: Trade;
  openPositions?: OpenPositionLite[];
  defaults?: FormDefaults;
  tags?: Tag[];
  selectedTagIds?: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  // Track assetType locally so the ticker autocomplete can scope its search.
  const [assetType, setAssetType] = useState<AssetType>(
    trade?.assetType ?? defaults?.assetType ?? "STOCK",
  );

  // The averaging-preview interrupt is only meaningful in CREATE mode for an
  // open entry. Edits modify an existing trade tied to a known position.
  const isCreate = !trade;
  const [previewState, setPreviewState] = useState<{
    formData: FormData;
    position: OpenPositionLite;
    addQty: string;
    addPrice: string;
  } | null>(null);

  function findMatchingOpenPosition(formData: FormData): OpenPositionLite | null {
    if (!isCreate) return null;
    const asset = String(formData.get("asset") ?? "").trim().toUpperCase();
    const direction = String(formData.get("direction") ?? "");
    const exitPrice = String(formData.get("exitPrice") ?? "").trim();
    // Only intercept when the user is opening a NEW leg (no exit yet). If
    // they enter a closed trade in one shot, we just wire it up to the
    // matching position silently — the averaging preview is for the moment
    // they're committing fresh capital.
    if (exitPrice !== "") return null;
    return (
      openPositions.find(
        (p) => p.asset === asset && p.direction === direction,
      ) ?? null
    );
  }

  async function runSubmit(formData: FormData) {
    setErrors({});
    setFormError(null);
    try {
      const result: ActionResult | undefined = trade
        ? await updateTrade(trade.id, formData)
        : await createTrade(formData);
      if (result && !result.ok) {
        setFormError(result.error);
        if (result.fieldErrors) setErrors(result.fieldErrors);
        requestAnimationFrame(() => {
          errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }
    } catch (err) {
      if (err instanceof Error && !err.message.includes("NEXT_REDIRECT")) {
        setFormError(err.message);
      }
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const match = findMatchingOpenPosition(formData);
    if (match) {
      setPreviewState({
        formData,
        position: match,
        addQty: String(formData.get("quantity") ?? "0"),
        addPrice: String(formData.get("entryPrice") ?? "0"),
      });
      return;
    }
    startTransition(() => runSubmit(formData));
  }

  function confirmAveraging() {
    if (!previewState) return;
    const data = previewState.formData;
    setPreviewState(null);
    startTransition(() => runSubmit(data));
  }

  const fieldError = (k: string) => errors[k]?.[0];

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
        {formError && (
          <div
            ref={errorRef}
            role="alert"
            className="rounded-md border border-loss/30 bg-loss/10 px-4 py-3 text-sm text-loss"
          >
            {formError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <Label htmlFor="asset">Asset</Label>
            <TickerAutocomplete
              id="asset"
              name="asset"
              defaultValue={trade?.asset ?? defaults?.asset ?? ""}
              required
              autoFocus={!trade}
              assetType={assetType}
              onSelect={(hit) => setAssetType(hit.assetType)}
            />
            {fieldError("asset") && <p className="text-xs text-loss mt-1">{fieldError("asset")}</p>}
          </div>
          <div>
            <Label htmlFor="assetType">Type</Label>
            <Select
              id="assetType"
              name="assetType"
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as AssetType)}
              required
            >
              <option value="STOCK">Stock</option>
              <option value="CRYPTO">Crypto</option>
              <option value="FOREX">Forex</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="direction">Direction</Label>
            <Select
              id="direction"
              name="direction"
              defaultValue={trade?.direction ?? defaults?.direction ?? "LONG"}
              required
            >
              <option value="LONG">Long</option>
              <option value="SHORT">Short</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="entryPrice">Entry price</Label>
            <Input
              id="entryPrice"
              name="entryPrice"
              type="number"
              step="any"
              min="0"
              placeholder="100.00"
              defaultValue={trade?.entryPrice.toString() ?? ""}
              required
            />
            {fieldError("entryPrice") && <p className="text-xs text-loss mt-1">{fieldError("entryPrice")}</p>}
          </div>
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              step="any"
              min="0"
              placeholder="10"
              defaultValue={trade?.quantity.toString() ?? ""}
              required
            />
            {fieldError("quantity") && <p className="text-xs text-loss mt-1">{fieldError("quantity")}</p>}
          </div>
          <div>
            <Label htmlFor="fees">Fees</Label>
            <Input
              id="fees"
              name="fees"
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              defaultValue={trade?.fees.toString() ?? "0"}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="entryDate">Entry date</Label>
          <Input
            id="entryDate"
            name="entryDate"
            type="datetime-local"
            defaultValue={trade ? toLocalDateInput(trade.entryDate) : toDateInputValue(new Date())}
            required
          />
        </div>

        <div className="rounded-md border border-border-strong/40 bg-bg-elevated/50 p-4 space-y-4">
          <p className="text-xs text-fg-muted">
            Fill exit price + date to mark this trade closed. Leave blank to keep it open.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="exitPrice">Exit price</Label>
              <Input
                id="exitPrice"
                name="exitPrice"
                type="number"
                step="any"
                min="0"
                placeholder="—"
                defaultValue={trade?.exitPrice?.toString() ?? ""}
              />
              {fieldError("exitPrice") && <p className="text-xs text-loss mt-1">{fieldError("exitPrice")}</p>}
            </div>
            <div>
              <Label htmlFor="exitDate">Exit date</Label>
              <Input
                id="exitDate"
                name="exitDate"
                type="datetime-local"
                defaultValue={trade?.exitDate ? toLocalDateInput(trade.exitDate) : ""}
              />
            </div>
          </div>
        </div>

        <div>
          <Label>Tags</Label>
          <TagPicker tags={tags} defaultSelectedIds={selectedTagIds} />
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            placeholder="What was the thesis? How did it play out?"
            defaultValue={trade?.notes ?? ""}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isShared"
            name="isShared"
            defaultChecked={trade?.isShared ?? false}
            className="w-4 h-4 rounded border-border bg-bg-elevated accent-accent"
          />
          <Label htmlFor="isShared" className="mb-0">
            Share this trade with friends
          </Label>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={pending} data-testid="submit-trade">
            {pending ? "Saving…" : trade ? "Save changes" : "Create trade"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>

      {previewState && (
        <AveragingPreviewModal
          open
          asset={previewState.position.asset}
          position={previewState.position}
          addQty={previewState.addQty}
          addPrice={previewState.addPrice}
          marketPrice={null}
          pending={pending}
          onCancel={() => setPreviewState(null)}
          onConfirm={confirmAveraging}
        />
      )}
    </>
  );
}
