import { describe, it, expect } from "vitest";
import { buildCoachFacts } from "@/lib/coach/facts";
import { hashFacts } from "@/lib/coach/report";
import { coachReportSchema, GEMINI_RESPONSE_SCHEMA } from "@/lib/coach/schema";
import { isRetryableStatus } from "@/lib/coach/gemini";

function validReport() {
  return {
    headline: "You cut winners early and let losers run.",
    findings: [
      {
        title: "Losers held 4x longer",
        category: "EXIT_DISCIPLINE",
        severity: "HIGH",
        observation: "Winners are closed after 3h on average, losers after 12h.",
        evidence: ["avgHoldHoursWinners: 3", "avgHoldHoursLosers: 12"],
        suggestion: "Set a stop at entry and let it execute without manual override.",
      },
    ],
    strengths: ["Win rate is above 50%."],
    focusThisMonth: "Define the exit before entering the trade.",
  };
}

describe("hashFacts", () => {
  it("ignores generatedAt so an unchanged history reuses the cached report", () => {
    const a = buildCoachFacts([], [], new Date("2026-01-01T00:00:00.000Z"));
    const b = buildCoachFacts([], [], new Date("2026-06-01T00:00:00.000Z"));
    expect(a.generatedAt).not.toBe(b.generatedAt);
    expect(hashFacts(a)).toBe(hashFacts(b));
  });

  it("changes when the underlying numbers change", () => {
    const empty = buildCoachFacts([], []);
    const withCash = buildCoachFacts(
      [],
      [
        {
          id: "cf1",
          userId: "u1",
          type: "DEPOSIT",
          amount: 1000,
          currency: "USD",
          occurredAt: new Date("2026-01-01"),
          note: null,
          assetSymbol: null,
          createdAt: new Date("2026-01-01"),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      ],
    );
    expect(hashFacts(empty)).not.toBe(hashFacts(withCash));
  });
});

describe("coachReportSchema", () => {
  it("accepts a well-formed report", () => {
    expect(coachReportSchema.safeParse(validReport()).success).toBe(true);
  });

  it("rejects an unknown category or severity", () => {
    const bad = validReport();
    bad.findings[0].category = "VIBES";
    expect(coachReportSchema.safeParse(bad).success).toBe(false);

    const bad2 = validReport();
    bad2.findings[0].severity = "CATASTROPHIC";
    expect(coachReportSchema.safeParse(bad2).success).toBe(false);
  });

  it("rejects a report with no findings", () => {
    const bad = { ...validReport(), findings: [] };
    expect(coachReportSchema.safeParse(bad).success).toBe(false);
  });

  it("defaults evidence and strengths when the model omits them", () => {
    const report = validReport();
    const finding = { ...report.findings[0] } as Record<string, unknown>;
    delete finding.evidence;
    const parsed = coachReportSchema.safeParse({
      ...report,
      findings: [finding],
      strengths: undefined,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.findings[0].evidence).toEqual([]);
      expect(parsed.data.strengths).toEqual([]);
    }
  });
});

describe("GEMINI_RESPONSE_SCHEMA", () => {
  // The Gemini responseSchema and the zod schema must describe the same shape,
  // or generation is constrained to something validation will then reject.
  it("declares the same top-level keys the validator requires", () => {
    expect(Object.keys(GEMINI_RESPONSE_SCHEMA.properties).sort()).toEqual([
      "findings",
      "focusThisMonth",
      "headline",
      "strengths",
    ]);
  });

  it("uses Gemini's uppercase type names, not JSON Schema's", () => {
    expect(GEMINI_RESPONSE_SCHEMA.type).toBe("OBJECT");
    expect(GEMINI_RESPONSE_SCHEMA.properties.findings.type).toBe("ARRAY");
    expect(GEMINI_RESPONSE_SCHEMA.properties.headline.type).toBe("STRING");
  });

  it("constrains findings to the categories the validator allows", () => {
    const categories = GEMINI_RESPONSE_SCHEMA.properties.findings.items.properties.category.enum;
    for (const c of categories) {
      const report = validReport();
      report.findings[0].category = c;
      expect(coachReportSchema.safeParse(report).success).toBe(true);
    }
  });
});

describe("isRetryableStatus", () => {
  it("retries Google-side capacity failures", () => {
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(504)).toBe(true);
  });

  it("does not retry quota, auth, or a stale model name", () => {
    // 429 is quota — retrying makes it worse, not better.
    expect(isRetryableStatus(429)).toBe(false);
    expect(isRetryableStatus(403)).toBe(false);
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });
});
