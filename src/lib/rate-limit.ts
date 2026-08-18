// Best-effort, in-process rate limiting.
//
// Deliberately NOT backed by the database. The ticker autocomplete fires as
// the user types, and a counter row per keystroke would cost more than the
// provider call it is meant to protect.
//
// The tradeoff, stated plainly: serverless instances are ephemeral and several
// can run at once, so a caller spread across instances gets some multiple of
// the stated budget. This exists to stop a runaway client or a naive script
// from burning the one shared Finnhub key — not to defeat a distributed
// attacker. Quotas that must actually hold (the Coach's 10 reports/day) are
// counted in Postgres instead.

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

// Bounds memory on a long-lived warm instance.
const MAX_KEYS = 5_000;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    if (buckets.size >= MAX_KEYS) sweep(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  return {
    ok: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

function sweep(now: number): void {
  for (const [key, window] of buckets) {
    if (now >= window.resetAt) buckets.delete(key);
  }
  // Still full of live windows — drop the half closest to expiry rather than
  // grow without bound.
  if (buckets.size >= MAX_KEYS) {
    const byExpiry = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (const [key] of byExpiry.slice(0, Math.floor(byExpiry.length / 2))) {
      buckets.delete(key);
    }
  }
}

/** Test seam — the module-level map otherwise leaks between test cases. */
export function resetRateLimits(): void {
  buckets.clear();
}
