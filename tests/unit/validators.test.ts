import { describe, it, expect } from "vitest";
import { tradeFormSchema } from "@/lib/validators";

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
