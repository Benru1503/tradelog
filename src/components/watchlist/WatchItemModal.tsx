"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AssetType } from "@prisma/client";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { TickerAutocomplete } from "@/components/ui/TickerAutocomplete";
import { cn } from "@/lib/utils";
import { createWatchItem } from "@/app/(app)/watchlist/actions";

export function WatchItemModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [direction, setDirection] = useState<"BUY" | "SELL" | "">("");
  const [assetType, setAssetType] = useState<AssetType>("STOCK");
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function reset() {
    setDirection("");
    setAssetType("STOCK");
    setErrors({});
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("targetDirection", direction);
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const result = await createWatchItem(formData);
      if (!result.ok) {
        setFormError(result.error);
        if (result.fieldErrors) setErrors(result.fieldErrors);
        return;
      }
      toast.success("Added to watchlist");
      reset();
      onClose();
      router.refresh();
    });
  }

  const fieldError = (k: string) => errors[k]?.[0];

  return (
    <Modal open={open} onClose={onClose} size="md" labelledBy="watch-modal-title">
      <ModalHeader id="watch-modal-title">Add to watchlist</ModalHeader>
      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          {formError && (
            <div className="rounded-md border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="w-asset">Symbol</Label>
              <TickerAutocomplete
                id="w-asset"
                name="asset"
                required
                autoFocus
                assetType={assetType}
                onSelect={(hit) => setAssetType(hit.assetType)}
              />
              {fieldError("asset") && (
                <p className="text-xs text-loss mt-1">{fieldError("asset")}</p>
              )}
            </div>
            <div>
              <Label htmlFor="w-type">Type</Label>
              <Select
                id="w-type"
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="w-target">Target price (optional)</Label>
              <Input
                id="w-target"
                name="targetPrice"
                type="number"
                step="any"
                min="0"
                placeholder="—"
              />
              {fieldError("targetPrice") && (
                <p className="text-xs text-loss mt-1">{fieldError("targetPrice")}</p>
              )}
            </div>
            <div>
              <Label>Alert when</Label>
              <div className="flex gap-1.5 mt-1">
                {(["BUY", "SELL"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDirection(direction === d ? "" : d)}
                    className={cn(
                      "flex-1 px-3 py-2 rounded-lg text-xs ring-1 ring-inset transition-colors",
                      direction === d
                        ? d === "BUY"
                          ? "bg-profit/15 text-profit ring-profit/40"
                          : "bg-loss/15 text-loss ring-loss/40"
                        : "ring-border text-fg-muted hover:text-fg",
                    )}
                  >
                    {d === "BUY" ? "Falls to ≤" : "Rises to ≥"}
                  </button>
                ))}
              </div>
              {fieldError("targetDirection") && (
                <p className="text-xs text-loss mt-1">{fieldError("targetDirection")}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="w-note">Note (optional)</Label>
            <Textarea
              id="w-note"
              name="note"
              placeholder="Buy on dip / breakout watch / etc."
              rows={2}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add to watchlist"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
