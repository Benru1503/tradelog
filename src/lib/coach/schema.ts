// The contract between the coach prompt and the app.
//
// Two schemas describe the same shape on purpose:
//  - GEMINI_RESPONSE_SCHEMA constrains generation (Gemini's `responseSchema`
//    is an OpenAPI 3.0 subset — uppercase types, no $ref, no unions).
//  - coachReportSchema (zod) validates what actually came back before it is
//    trusted or persisted. Constrained decoding is not a guarantee, and this
//    is the project's existing validation convention.

import { z } from "zod";

export const FINDING_CATEGORIES = [
  "EXIT_DISCIPLINE",
  "RISK_MANAGEMENT",
  "POSITION_SIZING",
  "ENTRY_TIMING",
  "CONSISTENCY",
  "COSTS",
  "JOURNALING",
] as const;

export const FINDING_SEVERITIES = ["HIGH", "MEDIUM", "LOW"] as const;

export type FindingCategory = (typeof FINDING_CATEGORIES)[number];
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const coachFindingSchema = z.object({
  title: z.string().trim().min(1).max(120),
  category: z.enum(FINDING_CATEGORIES),
  severity: z.enum(FINDING_SEVERITIES),
  observation: z.string().trim().min(1).max(1200),
  evidence: z.array(z.string().trim().min(1).max(200)).max(6).default([]),
  suggestion: z.string().trim().min(1).max(800),
});

export const coachReportSchema = z.object({
  headline: z.string().trim().min(1).max(300),
  findings: z.array(coachFindingSchema).min(1).max(6),
  strengths: z.array(z.string().trim().min(1).max(300)).max(4).default([]),
  focusThisMonth: z.string().trim().min(1).max(600),
});

export type CoachFinding = z.infer<typeof coachFindingSchema>;
export type CoachReportBody = z.infer<typeof coachReportSchema>;

/**
 * Gemini `generationConfig.responseSchema`. Uppercase type names and
 * `propertyOrdering` are Gemini-specific — do not swap in a JSON Schema dump.
 */
export const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: {
      type: "STRING",
      description: "One sentence, max 30 words, summarising the trader's single biggest pattern.",
    },
    findings: {
      type: "ARRAY",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING", description: "Short label, max 8 words." },
          category: { type: "STRING", enum: [...FINDING_CATEGORIES] },
          severity: { type: "STRING", enum: [...FINDING_SEVERITIES] },
          observation: {
            type: "STRING",
            description:
              "What the data shows. Quote the exact figures from the facts payload. 2-4 sentences.",
          },
          evidence: {
            type: "ARRAY",
            maxItems: 4,
            items: { type: "STRING" },
            description:
              "Short factual citations copied verbatim from the payload, e.g. 'avgLoss: -412.5'.",
          },
          suggestion: {
            type: "STRING",
            description: "One concrete, testable change for next month. 1-3 sentences.",
          },
        },
        required: ["title", "category", "severity", "observation", "evidence", "suggestion"],
        propertyOrdering: [
          "title",
          "category",
          "severity",
          "observation",
          "evidence",
          "suggestion",
        ],
      },
    },
    strengths: {
      type: "ARRAY",
      maxItems: 3,
      items: { type: "STRING" },
      description: "Things this trader genuinely does well, grounded in the numbers.",
    },
    focusThisMonth: {
      type: "STRING",
      description: "The single highest-leverage habit to change, stated as one clear instruction.",
    },
  },
  required: ["headline", "findings", "strengths", "focusThisMonth"],
  propertyOrdering: ["headline", "findings", "strengths", "focusThisMonth"],
} as const;
