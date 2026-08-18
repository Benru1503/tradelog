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

// Reports are a single long generation, not a quick quote lookup. The whole
// call — retries included — has to finish inside the hosting platform's
// function limit (60s on Vercel Hobby, set via `maxDuration` on the coach
// page), so the budget below is the ceiling and each attempt gets whatever is
// left of it. A single 60s attempt, as this used to be, would be killed by the
// platform before its own timeout ever fired.
const TOTAL_BUDGET_MS = 55_000;
const ATTEMPT_TIMEOUT_MS = 25_000;
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [800, 2_000];
/** Don't start an attempt there isn't time to finish. */
const MIN_ATTEMPT_MS = 8_000;
const MAX_OUTPUT_TOKENS = 8192;

/**
 * 503 "model is overloaded" is the common one on the free tier — Google-side
 * capacity, nothing to do with the key or the request, and usually gone on the
 * next attempt. 429 is deliberately NOT here: that's quota, and hammering it
 * makes things worse.
 */
export function isRetryableStatus(status: number): boolean {
  return status === 500 || status === 502 || status === 503 || status === 504;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  const startedAt = Date.now();
  let lastTransientError = "";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
    if (remaining < MIN_ATTEMPT_MS) break;

    let res: Response;
    try {
      res = await fetch(`${ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(Math.min(ATTEMPT_TIMEOUT_MS, remaining)),
        cache: "no-store",
      });
    } catch {
      // Network blip or attempt timeout. Worth one more go if the budget allows.
      lastTransientError = "Couldn't reach Gemini (network error or timeout).";
      if (await backOff(attempt, startedAt)) continue;
      return { ok: false, error: `${lastTransientError} Try again.` };
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
      if (isRetryableStatus(res.status)) {
        lastTransientError = detail;
        if (await backOff(attempt, startedAt)) continue;
        return {
          ok: false,
          error: `Gemini is overloaded on Google's side right now — tried ${attempt + 1} time${attempt ? "s" : ""}. Wait a moment and press Regenerate. (${detail})`,
        };
      }
      return { ok: false, error: `Gemini error: ${detail}` };
    }

    if (data.promptFeedback?.blockReason) {
      return {
        ok: false,
        error: `Gemini blocked the request (${data.promptFeedback.blockReason}).`,
      };
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

  return {
    ok: false,
    error: lastTransientError
      ? `Gemini didn't respond in time — ${lastTransientError} Press Regenerate to retry.`
      : "Gemini didn't respond in time. Press Regenerate to retry.",
  };
}

/**
 * Waits before the next attempt. Returns false when there is no attempt left,
 * either because we're out of tries or the remaining budget can't fit one.
 */
async function backOff(attempt: number, startedAt: number): Promise<boolean> {
  if (attempt >= MAX_ATTEMPTS - 1) return false;
  const wait = RETRY_BACKOFF_MS[attempt] ?? 2_000;
  const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
  if (remaining - wait < MIN_ATTEMPT_MS) return false;
  await sleep(wait);
  return true;
}
