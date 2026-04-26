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
