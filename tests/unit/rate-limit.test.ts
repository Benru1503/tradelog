import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows exactly `limit` calls inside the window", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("k", 3, 60_000, now).ok).toBe(true);
    }
    expect(rateLimit("k", 3, 60_000, now).ok).toBe(false);
  });

  it("reports remaining budget, floored at zero", () => {
    const now = 1_000_000;
    expect(rateLimit("k", 2, 60_000, now).remaining).toBe(1);
    expect(rateLimit("k", 2, 60_000, now).remaining).toBe(0);
    expect(rateLimit("k", 2, 60_000, now).remaining).toBe(0);
  });

  it("starts a fresh window once the old one expires", () => {
    const now = 1_000_000;
    expect(rateLimit("k", 1, 60_000, now).ok).toBe(true);
    expect(rateLimit("k", 1, 60_000, now + 59_999).ok).toBe(false);
    expect(rateLimit("k", 1, 60_000, now + 60_000).ok).toBe(true);
  });

  it("keys are independent, so one user cannot spend another's budget", () => {
    const now = 1_000_000;
    expect(rateLimit("user-a", 1, 60_000, now).ok).toBe(true);
    expect(rateLimit("user-a", 1, 60_000, now).ok).toBe(false);
    expect(rateLimit("user-b", 1, 60_000, now).ok).toBe(true);
  });

  it("returns a retry hint of at least one second while blocked", () => {
    const now = 1_000_000;
    rateLimit("k", 1, 60_000, now);
    const blocked = rateLimit("k", 1, 60_000, now + 59_500);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});
