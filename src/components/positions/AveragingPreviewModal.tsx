"use client";

import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { previewAveraging } from "@/lib/positions";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

interface PositionShape {
  asset: string;
  totalQty: string | number | { toString: () => string };
  avgCost: string | number | { toString: () => string };
}

interface Props {
  open: boolean;
  asset: string;
  position: PositionShape;
  addQty: string;
  addPrice: string;
  marketPrice?: number | null;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// "If you add this leg, here's what your position becomes." Shown right
// before the trade is committed so the user sees the new average and
// break-even price first. Three-column layout matches IBKR / Schwab.
export function AveragingPreviewModal({
  open,
  asset,
  position,
  addQty,
  addPrice,
  marketPrice,
  pending,
  onCancel,
  onConfirm,
}: Props) {
  const preview = previewAveraging(
    {
      totalQty: position.totalQty.toString(),
      avgCost: position.avgCost.toString(),
    } as never,
    addQty || "0",
    addPrice || "0",
  );

  const breakEven = preview.afterAvg;
  const distancePct =
    marketPrice && marketPrice > 0 && breakEven.gt(0)
      ? breakEven.minus(marketPrice).dividedBy(marketPrice).times(100).toNumber()
      : null;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="lg"
      labelledBy="averaging-modal-title"
    >
      <ModalHeader id="averaging-modal-title">
        Adding to {asset} position
      </ModalHeader>
      <ModalBody className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <PreviewColumn
            label="Before"
            primary={`${formatNumber(preview.beforeQty, 4)} sh`}
            secondary={`@ ${formatCurrency(preview.beforeAvg)}`}
            footer={`Cost ${formatCurrency(preview.beforeCost)}`}
          />
          <PreviewColumn
            label="Adding"
            tone="accent"
            primary={`${formatNumber(preview.addingQty, 4)} sh`}
            secondary={`@ ${formatCurrency(preview.addingPrice)}`}
            footer={`Cost ${formatCurrency(preview.addingCost)}`}
          />
          <PreviewColumn
            label="After"
            tone="emphasis"
            primary={`${formatNumber(preview.afterQty, 4)} sh`}
            secondary={`Avg ${formatCurrency(preview.afterAvg)}`}
            footer={`Cost ${formatCurrency(preview.afterCost)}`}
          />
        </div>

        <div className="rounded-xl border border-border bg-bg-elevated/40 p-4 space-y-2 text-sm">
          <Stat label="Capital deployed (after)" value={formatCurrency(preview.afterCost)} />
          <Stat
            label="Break-even price"
            value={formatCurrency(preview.afterAvg)}
          />
          {distancePct != null && (
            <Stat
              label="Distance to break-even"
              value={
                <span
                  className={cn(
                    "font-mono tabular-nums",
                    distancePct < 0 ? "text-profit" : distancePct > 0 ? "text-loss" : "text-fg-muted",
                  )}
                >
                  {distancePct > 0 ? "+" : ""}
                  {distancePct.toFixed(1)}% from market
                </span>
              }
            />
          )}
          {distancePct == null && marketPrice == null && (
            <p className="text-xs text-fg-subtle pt-1">
              Live market price not available — distance to break-even will appear
              once the price feed is connected.
            </p>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" onClick={onConfirm} disabled={pending}>
          {pending ? "Saving…" : "Confirm add"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function PreviewColumn({
  label,
  primary,
  secondary,
  footer,
  tone,
}: {
  label: string;
  primary: string;
  secondary: string;
  footer: string;
  tone?: "accent" | "emphasis";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-bg-card p-4",
        tone === "accent" && "border-accent/40 bg-accent/5",
        tone === "emphasis" && "border-fg/20",
      )}
    >
      <div className="text-[11px] uppercase tracking-wider text-fg-subtle">
        {label}
      </div>
      <div className={cn("text-base font-semibold mt-2 font-mono tabular-nums", tone === "accent" && "text-accent")}>
        {primary}
      </div>
      <div className="text-xs text-fg-muted mt-1 font-mono">{secondary}</div>
      <div className="text-xs text-fg-subtle mt-3 font-mono">{footer}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-fg-muted">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}
