import { z } from "zod";

const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^-?\d+(\.\d+)?$/.test(v) && !isNaN(Number(v)), {
    message: "Must be a valid number",
  });

const positiveDecimal = decimalString.refine((v) => Number(v) > 0, {
  message: "Must be greater than 0",
});

const nonNegativeDecimal = decimalString.refine((v) => Number(v) >= 0, {
  message: "Must be 0 or greater",
});

export const tradeFormSchema = z
  .object({
    asset: z.string().trim().min(1, "Required").max(40),
    assetType: z.enum(["STOCK", "CRYPTO", "FOREX"]),
    direction: z.enum(["LONG", "SHORT"]),
    entryPrice: positiveDecimal,
    exitPrice: z.union([z.literal(""), decimalString]).optional(),
    quantity: positiveDecimal,
    entryDate: z.string().min(1, "Required"),
    exitDate: z.union([z.literal(""), z.string()]).optional(),
    fees: nonNegativeDecimal.default("0"),
    notes: z.string().max(5000).optional().nullable(),
    isShared: z.boolean().default(false),
  })
  .refine(
    (data) => {
      const hasExitPrice = data.exitPrice && data.exitPrice !== "";
      const hasExitDate = data.exitDate && data.exitDate !== "";
      // either both or neither
      return Boolean(hasExitPrice) === Boolean(hasExitDate);
    },
    {
      message: "Set both exit price and exit date to close the trade",
      path: ["exitPrice"],
    },
  );

export type TradeFormInput = z.infer<typeof tradeFormSchema>;

const assetType = z.enum(["STOCK", "CRYPTO", "FOREX"]);

export const cashFlowFormSchema = z.object({
  type: z.enum(["DEPOSIT", "WITHDRAWAL", "DIVIDEND", "FEE_ADJUST"]),
  amount: positiveDecimal,
  currency: z.string().trim().length(3).default("USD"),
  occurredAt: z.string().min(1, "Required"),
  note: z.string().max(500).optional().nullable(),
});
export type CashFlowFormInput = z.infer<typeof cashFlowFormSchema>;

export const watchItemFormSchema = z
  .object({
    asset: z.string().trim().min(1, "Required").max(40),
    assetType,
    targetPrice: z.union([z.literal(""), positiveDecimal]).optional(),
    targetDirection: z.enum(["BUY", "SELL"]).optional(),
    note: z.string().max(500).optional().nullable(),
  })
  .refine(
    (data) => {
      const hasPrice = data.targetPrice && data.targetPrice !== "";
      const hasDir = !!data.targetDirection;
      // A price without a direction can't fire an alert, so still reject that.
      // The other way around is fine — the action drops a stray direction
      // when there's no price, so users can leave both empty.
      return !hasPrice || hasDir;
    },
    {
      message: "Pick when to alert (Falls to ≤ / Rises to ≥)",
      path: ["targetDirection"],
    },
  );
export type WatchItemFormInput = z.infer<typeof watchItemFormSchema>;

export const tickerSearchSchema = z.object({
  q: z.string().trim().min(1).max(40),
  assetType: assetType.optional(),
});
export type TickerSearchInput = z.infer<typeof tickerSearchSchema>;
