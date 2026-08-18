import { describe, expect, it } from "vitest";
import { isAllowedProvider } from "@/lib/auth-policy";

describe("isAllowedProvider", () => {
  it("accepts a Google identity", () => {
    expect(isAllowedProvider({ app_metadata: { provider: "google", providers: ["google"] } })).toBe(
      true,
    );
  });

  it("rejects an email/password identity — the bypass this exists to close", () => {
    expect(isAllowedProvider({ app_metadata: { provider: "email", providers: ["email"] } })).toBe(
      false,
    );
  });

  it("rejects an identity that linked a password alongside Google", () => {
    expect(
      isAllowedProvider({ app_metadata: { provider: "google", providers: ["google", "email"] } }),
    ).toBe(false);
  });

  it("rejects other OAuth providers that could be enabled later", () => {
    expect(isAllowedProvider({ app_metadata: { provider: "github", providers: ["github"] } })).toBe(
      false,
    );
  });

  it("fails closed on a missing user or empty metadata", () => {
    expect(isAllowedProvider(null)).toBe(false);
    expect(isAllowedProvider(undefined)).toBe(false);
    expect(isAllowedProvider({})).toBe(false);
    expect(isAllowedProvider({ app_metadata: {} })).toBe(false);
  });
});
