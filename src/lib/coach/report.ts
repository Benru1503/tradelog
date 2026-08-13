// Orchestration: facts -> prompt -> Gemini -> validated report.
// Network-bound but Prisma-free; persistence lives in the server action.

import { createHash } from "node:crypto";
import type { CoachFacts } from "./facts";
import { generateJson } from "./gemini";
import { buildCoachPrompt, SYSTEM_INSTRUCTION } from "./prompt";
import { coachReportSchema, GEMINI_RESPONSE_SCHEMA, type CoachReportBody } from "./schema";

/**
 * Stable fingerprint of a fact sheet, used to reuse an existing report when
 * nothing about the trading history has changed. `generatedAt` is excluded —
 * it changes on every call and would defeat the cache.
 */
export function hashFacts(facts: CoachFacts): string {
  const { generatedAt: _generatedAt, ...stable } = facts;
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex").slice(0, 32);
}

export type GenerateReportResult =
  | { ok: true; report: CoachReportBody; model: string }
  | { ok: false; error: string };

export async function generateCoachReport(facts: CoachFacts): Promise<GenerateReportResult> {
  const res = await generateJson({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: buildCoachPrompt(facts),
    schema: GEMINI_RESPONSE_SCHEMA,
  });
  if (!res.ok) return res;

  let parsed: unknown;
  try {
    parsed = JSON.parse(res.text);
  } catch {
    return { ok: false, error: "Gemini returned malformed JSON. Try regenerating." };
  }

  // Constrained decoding is a strong hint, not a guarantee — validate before trusting.
  const validated = coachReportSchema.safeParse(parsed);
  if (!validated.success) {
    return {
      ok: false,
      error: "Gemini's report didn't match the expected shape. Try regenerating.",
    };
  }

  return { ok: true, report: validated.data, model: res.model };
}
