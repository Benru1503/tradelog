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
  // Optional ticker; only meaningful for DIVIDEND. The action upper-cases and
  // drops it for non-dividend types, so the validator just sanity-bounds it.
  assetSymbol: z
    .string()
    .trim()
    .max(40)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v.toUpperCase() : null)),
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

export const firstTradeDateSchema = z.object({
  symbol: z.string().trim().min(1).max(40),
  assetType,
});
export type FirstTradeDateInput = z.infer<typeof firstTradeDateSchema>;

// /playground — what-if scenario. `sellDate` is optional; when omitted we
// run the scenario through to "now" using the latest available candle.
export const whatIfFormSchema = z
  .object({
    asset: z.string().trim().toUpperCase().min(1, "Required").max(40),
    assetType,
    buyAmount: positiveDecimal,
    buyDate: z.string().min(1, "Required"),
    sellDate: z.union([z.literal(""), z.string()]).optional(),
  })
  .refine(
    (data) => {
      if (!data.sellDate) return true;
      return new Date(data.sellDate) >= new Date(data.buyDate);
    },
    { message: "Sell date must be on or after buy date", path: ["sellDate"] },
  );
export type WhatIfFormInput = z.infer<typeof whatIfFormSchema>;

// /playground — DCA scenario. `to` is optional; when omitted we run through
// the latest available candle.
export const dcaFormSchema = z
  .object({
    asset: z.string().trim().toUpperCase().min(1, "Required").max(40),
    assetType,
    amount: positiveDecimal,
    cadence: z.enum(["WEEKLY", "MONTHLY"]),
    from: z.string().min(1, "Required"),
    to: z.union([z.literal(""), z.string()]).optional(),
  })
  .refine(
    (data) => {
      if (!data.to) return true;
      return new Date(data.to) >= new Date(data.from);
    },
    { message: "End date must be on or after start date", path: ["to"] },
  );
export type DcaFormInput = z.infer<typeof dcaFormSchema>;

// /predict — ML direction forecast. Horizon values mirror the
// PredictionHorizon enum (D1 = next day, W1 = next week).
export const predictFormSchema = z.object({
  asset: z.string().trim().toUpperCase().min(1, "Required").max(40),
  assetType,
  horizon: z.enum(["D1", "W1"]),
});
export type PredictFormInput = z.infer<typeof predictFormSchema>;
