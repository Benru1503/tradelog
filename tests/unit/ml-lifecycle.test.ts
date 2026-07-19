import { describe, it, expect } from "vitest";
import {
  HORIZON_MS,
  confidence,
  decideDirection,
  decideOutcome,
  resolveTime,
  utcDayKey,
  utcDayStart,
} from "@/lib/ml/lifecycle";

describe("prediction lifecycle rules", () => {
  it("resolveTime adds 24h for D1 and 7 days for W1", () => {
    const t = new Date("2026-07-19T14:30:00.000Z");
    expect(resolveTime(t, "D1").toISOString()).toBe("2026-07-20T14:30:00.000Z");
    expect(resolveTime(t, "W1").toISOString()).toBe("2026-07-26T14:30:00.000Z");
    expect(HORIZON_MS.W1 / HORIZON_MS.D1).toBe(7);
  });

  it("decideDirection: 0.5 and above is UP, below is DOWN", () => {
    expect(decideDirection(0.5)).toBe("UP");
    expect(decideDirection(0.500001)).toBe("UP");
    expect(decideDirection(0.499999)).toBe("DOWN");
  });

  it("confidence is the probability of the predicted side", () => {
    expect(confidence(0.7)).toBeCloseTo(0.7, 12);
    expect(confidence(0.3)).toBeCloseTo(0.7, 12);
    expect(confidence(0.5)).toBe(0.5);
  });

  it("UP scores HIT only when price actually rose", () => {
    expect(decideOutcome("UP", 100, 101)).toBe("HIT");
    expect(decideOutcome("UP", 100, 99)).toBe("MISS");
  });

  it("DOWN scores HIT only when price actually fell", () => {
    expect(decideOutcome("DOWN", 100, 99)).toBe("HIT");
    expect(decideOutcome("DOWN", 100, 101)).toBe("MISS");
  });

  it("an exactly flat price is a MISS for both directions", () => {
    expect(decideOutcome("UP", 100, 100)).toBe("MISS");
    expect(decideOutcome("DOWN", 100, 100)).toBe("MISS");
  });

  it("utcDayKey/utcDayStart bucket by UTC calendar day", () => {
    const lateEvening = new Date("2026-07-19T23:59:59.999Z");
    expect(utcDayKey(lateEvening)).toBe("2026-07-19");
    expect(utcDayStart(lateEvening).toISOString()).toBe("2026-07-19T00:00:00.000Z");
    // Same instant in a western timezone is still the UTC day.
    expect(utcDayKey(new Date("2026-07-20T00:00:00.001Z"))).toBe("2026-07-20");
  });
});
