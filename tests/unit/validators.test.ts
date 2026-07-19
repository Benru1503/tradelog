import { describe, it, expect } from "vitest";
import {
  tradeFormSchema,
  cashFlowFormSchema,
  watchItemFormSchema,
  whatIfFormSchema,
  dcaFormSchema,
} from "@/lib/validators";

const base = {
  asset: "AAPL",
  assetType: "STOCK" as const,
  direction: "LONG" as const,
  entryPrice: "100",
  quantity: "10",
  entryDate: "2026-01-01T10:00",
  fees: "0",
};

describe("tradeFormSchema", () => {
  it("accepts an open trade with no exit", () => {
    const r = tradeFormSchema.safeParse({ ...base });
    expect(r.success).toBe(true);
  });

  it("accepts a closed trade with both exit fields", () => {
    const r = tradeFormSchema.safeParse({
      ...base,
      exitPrice: "110",
      exitDate: "2026-01-02T10:00",
    });
    expect(r.success).toBe(true);
  });

  it("rejects partial close (exit price without date)", () => {
    const r = tradeFormSchema.safeParse({ ...base, exitPrice: "110" });
    expect(r.success).toBe(false);
  });

  it("rejects negative entry price", () => {
    const r = tradeFormSchema.safeParse({ ...base, entryPrice: "-1" });
    expect(r.success).toBe(false);
  });

  it("rejects zero quantity", () => {
    const r = tradeFormSchema.safeParse({ ...base, quantity: "0" });
    expect(r.success).toBe(false);
  });

  it("rejects empty asset", () => {
    const r = tradeFormSchema.safeParse({ ...base, asset: "" });
    expect(r.success).toBe(false);
  });
});

describe("cashFlowFormSchema", () => {
  const baseFlow = { type: "DEPOSIT" as const, amount: "100", occurredAt: "2026-01-01T10:00" };

  it("accepts a plain deposit", () => {
    expect(cashFlowFormSchema.safeParse(baseFlow).success).toBe(true);
  });

  it("rejects a zero amount", () => {
    expect(cashFlowFormSchema.safeParse({ ...baseFlow, amount: "0" }).success).toBe(false);
  });

  it("upper-cases the asset symbol and nulls empty strings", () => {
    const r = cashFlowFormSchema.safeParse({
      ...baseFlow,
      type: "DIVIDEND",
      assetSymbol: "msft",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.assetSymbol).toBe("MSFT");

    const empty = cashFlowFormSchema.safeParse({ ...baseFlow, assetSymbol: "" });
    expect(empty.success).toBe(true);
    if (empty.success) expect(empty.data.assetSymbol).toBeNull();
  });

  it("rejects a currency that isn't 3 letters", () => {
    expect(cashFlowFormSchema.safeParse({ ...baseFlow, currency: "USDT" }).success).toBe(false);
  });
});

describe("watchItemFormSchema", () => {
  const baseItem = { asset: "NVDA", assetType: "STOCK" as const };

  it("accepts an item with no target at all", () => {
    expect(watchItemFormSchema.safeParse(baseItem).success).toBe(true);
  });

  it("rejects a target price without a direction (alert can't fire)", () => {
    const r = watchItemFormSchema.safeParse({ ...baseItem, targetPrice: "500" });
    expect(r.success).toBe(false);
  });

  it("accepts price + direction together", () => {
    const r = watchItemFormSchema.safeParse({
      ...baseItem,
      targetPrice: "500",
      targetDirection: "BUY",
    });
    expect(r.success).toBe(true);
  });
});

describe("whatIfFormSchema", () => {
  const baseWhatIf = {
    asset: "btc",
    assetType: "CRYPTO" as const,
    buyAmount: "1000",
    buyDate: "2025-01-01",
  };

  it("accepts an open-ended scenario and upper-cases the asset", () => {
    const r = whatIfFormSchema.safeParse(baseWhatIf);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.asset).toBe("BTC");
  });

  it("rejects a sell date before the buy date", () => {
    const r = whatIfFormSchema.safeParse({ ...baseWhatIf, sellDate: "2024-01-01" });
    expect(r.success).toBe(false);
  });
});

describe("dcaFormSchema", () => {
  const baseDca = {
    asset: "BTC",
    assetType: "CRYPTO" as const,
    amount: "100",
    cadence: "MONTHLY" as const,
    from: "2025-01-01",
  };

  it("accepts an open-ended range", () => {
    expect(dcaFormSchema.safeParse(baseDca).success).toBe(true);
  });

  it("rejects an end date before the start date", () => {
    expect(dcaFormSchema.safeParse({ ...baseDca, to: "2024-06-01" }).success).toBe(false);
  });

  it("rejects a non-positive contribution amount", () => {
    expect(dcaFormSchema.safeParse({ ...baseDca, amount: "0" }).success).toBe(false);
  });
});
