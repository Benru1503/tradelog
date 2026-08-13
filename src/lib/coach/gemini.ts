// Minimal Gemini REST client. Server-side only — the API key must never
// reach the browser, same rule as src/lib/marketdata/*.
//
// Deliberately plain `fetch` rather than @google/genai: it keeps the feature
// dependency-free (no package-lock churn, which this repo treats as a hazard
// — see CLAUDE.md), and it matches how the market-data providers already call
// third-party APIs.
//
// Free tier notes: Google AI Studio keys work without billing, but quotas are
// per-account and the free tier permits Google to use submitted content to
// improve their products. Both are documented in docs/coach.md.

const ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// "gemini-2.5-flash" (the original default here) was deprecated for new
// Google accounts — generateContent 404s on it even though ListModels still
// lists it. `gemini-flash-latest` is Google's forward-compatible alias, kept
// pointed at their current recommended Flash model, so this default doesn't
// go stale the same way again.
/** Overridable so a specific pinned Flash model can be swapped in without a code change. */
export const DEFAULT_MODEL = "gemini-flash-latest";

// Reports are a single long generation, not a quick quote lookup.
const TIMEOUT_MS = 60_000;
const MAX_OUTPUT_TOKENS = 8192;

export function coachModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

export function isCoachConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export type GeminiResult = { ok: true; text: string; model: string } | { ok: false; error: string };

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
}

interface GenerateOptions {
  systemInstruction: string;
  prompt: string;
  /** Gemini responseSchema (OpenAPI 3.0 subset). */
  schema: unknown;
}

/**
 * Ask Gemini for a JSON object matching `schema`. Returns a result object
 * rather than throwing so server actions can surface a message to the UI,
 * matching the shape used by the predict action.
 */
export async function generateJson(opts: GenerateOptions): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error: "GEMINI_API_KEY is not set. Add it to .env.local and restart the dev server.",
    };
  }

  const model = coachModel();
  const body = {
    systemInstruction: { parts: [{ text: opts.systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: opts.schema,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.4,
    },
  };

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Couldn't reach Gemini (network error or timeout). Try again." };
  }

  let data: GeminiResponse;
  try {
    data = (await res.json()) as GeminiResponse;
  } catch {
    return { ok: false, error: `Gemini returned an unreadable response (HTTP ${res.status}).` };
  }

  if (!res.ok) {
    const detail = data.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 429) {
      return {
        ok: false,
        error: "Gemini free-tier rate limit reached. Wait a minute and try again.",
      };
    }
    if (res.status === 400 || res.status === 403) {
      return {
        ok: false,
        error: `Gemini rejected the request — check GEMINI_API_KEY. (${detail})`,
      };
    }
    if (res.status === 404) {
      // Usually a stale pinned snapshot (e.g. "gemini-2.5-flash" was
      // deprecated for new accounts even though ListModels still lists it) —
      // not a bad key. Google's error message says so directly.
      return {
        ok: false,
        error: `Model "${model}" isn't available for this key (${detail}). If you set GEMINI_MODEL, try "gemini-flash-latest" or unset it to use the default.`,
      };
    }
    return { ok: false, error: `Gemini error: ${detail}` };
  }

  if (data.promptFeedback?.blockReason) {
    return { ok: false, error: `Gemini blocked the request (${data.promptFeedback.blockReason}).` };
  }

  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    // MAX_TOKENS here usually means the model's reasoning consumed the output
    // budget before it emitted the JSON body.
    const reason = candidate?.finishReason ?? "empty response";
    return { ok: false, error: `Gemini returned no content (${reason}).` };
  }

  return { ok: true, text, model };
}
