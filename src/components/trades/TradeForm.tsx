"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Trade } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { createTrade, updateTrade, type ActionResult } from "@/app/(app)/trades/actions";
import { toDateInputValue } from "@/lib/utils";

function toLocalDateInput(date: Date | string | null) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return toDateInputValue(d);
}

export function TradeForm({ trade }: { trade?: Trade }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setErrors({});
    setFormError(null);

    startTransition(async () => {
      // Note: a successful action calls redirect() server-side, which throws
      // NEXT_REDIRECT. From the client's perspective the awaited promise either
      // resolves to undefined (and the router navigates) or returns an error
      // ActionResult. Either way `pending` stays true until navigation lands.
      try {
        const result: ActionResult | undefined = trade
          ? await updateTrade(trade.id, formData)
          : await createTrade(formData);
        if (result && !result.ok) {
          setFormError(result.error);
          if (result.fieldErrors) setErrors(result.fieldErrors);
          // Scroll the error banner into view so users see what went wrong.
          requestAnimationFrame(() => {
            errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          });
        }
      } catch (err) {
        // NEXT_REDIRECT is rethrown by the framework; only true errors reach here.
        if (err instanceof Error && !err.message.includes("NEXT_REDIRECT")) {
          setFormError(err.message);
        }
      }
    });
  }

  const fieldError = (k: string) => errors[k]?.[0];

  return (
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
          <Input
            id="asset"
            name="asset"
            placeholder="AAPL"
            defaultValue={trade?.asset ?? ""}
            required
            autoFocus={!trade}
          />
          {fieldError("asset") && <p className="text-xs text-loss mt-1">{fieldError("asset")}</p>}
        </div>
        <div>
          <Label htmlFor="assetType">Type</Label>
          <Select id="assetType" name="assetType" defaultValue={trade?.assetType ?? "STOCK"} required>
            <option value="STOCK">Stock</option>
            <option value="CRYPTO">Crypto</option>
            <option value="FOREX">Forex</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="direction">Direction</Label>
          <Select id="direction" name="direction" defaultValue={trade?.direction ?? "LONG"} required>
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
  );
}
