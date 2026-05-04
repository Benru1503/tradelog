"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { TickerAutocomplete } from "@/components/ui/TickerAutocomplete";
import { cn } from "@/lib/utils";
import { toDateInputValue } from "@/lib/utils";
import { createCashFlow } from "@/app/(app)/cashflows/actions";

type FlowType = "DEPOSIT" | "WITHDRAWAL" | "DIVIDEND" | "FEE_ADJUST";

const TYPES: Array<{ value: FlowType; label: string }> = [
  { value: "DEPOSIT", label: "Deposit" },
  { value: "WITHDRAWAL", label: "Withdrawal" },
  { value: "DIVIDEND", label: "Dividend" },
  { value: "FEE_ADJUST", label: "Fee" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  defaultType?: FlowType;
}

export function CashFlowModal({ open, onClose, defaultType = "DEPOSIT" }: Props) {
  const router = useRouter();
  const [type, setType] = useState<FlowType>(defaultType);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function reset() {
    setErrors({});
    setFormError(null);
    setType(defaultType);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("type", type);
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const result = await createCashFlow(formData);
      if (!result.ok) {
        setFormError(result.error);
        if (result.fieldErrors) setErrors(result.fieldErrors);
        return;
      }
      toast.success(
        type === "WITHDRAWAL"
          ? "Withdrawal recorded"
          : type === "DIVIDEND"
            ? "Dividend recorded"
            : type === "FEE_ADJUST"
              ? "Fee recorded"
              : "Deposit recorded",
      );
      reset();
      onClose();
      router.refresh();
    });
  }

  const fieldError = (k: string) => errors[k]?.[0];

  return (
    <Modal open={open} onClose={onClose} size="md" labelledBy="cashflow-modal-title">
      <ModalHeader id="cashflow-modal-title">Record cash flow</ModalHeader>
      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          {formError && (
            <div className="rounded-md border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">
              {formError}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ring-1 ring-inset",
                  type === t.value
                    ? "bg-accent/15 text-accent ring-accent/40"
                    : "ring-border text-fg-muted hover:text-fg hover:bg-bg-elevated",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cf-amount">Amount</Label>
              <Input
                id="cf-amount"
                name="amount"
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                required
                autoFocus
              />
              {fieldError("amount") && (
                <p className="text-xs text-loss mt-1">{fieldError("amount")}</p>
              )}
            </div>
            <div>
              <Label htmlFor="cf-currency">Currency</Label>
              <Input
                id="cf-currency"
                name="currency"
                defaultValue="USD"
                maxLength={3}
                className="uppercase"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="cf-date">Date</Label>
            <Input
              id="cf-date"
              name="occurredAt"
              type="datetime-local"
              defaultValue={toDateInputValue(new Date())}
              required
            />
            {fieldError("occurredAt") && (
              <p className="text-xs text-loss mt-1">{fieldError("occurredAt")}</p>
            )}
          </div>

          {type === "DIVIDEND" && (
            <div>
              <Label htmlFor="cf-asset">Ticker (optional)</Label>
              <TickerAutocomplete
                id="cf-asset"
                name="assetSymbol"
                assetType="STOCK"
              />
              <p className="text-xs text-fg-subtle mt-1">
                Lets the trade-detail page narrow dividends to this ticker. Leave blank for general dividend income.
              </p>
              {fieldError("assetSymbol") && (
                <p className="text-xs text-loss mt-1">{fieldError("assetSymbol")}</p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="cf-note">Note (optional)</Label>
            <Textarea
              id="cf-note"
              name="note"
              placeholder="From Schwab brokerage…"
              rows={2}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
