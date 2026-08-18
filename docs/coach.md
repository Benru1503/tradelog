# Trade Journal Coach (`/coach`)

An LLM review of **how the user trades** — behavioural patterns in their own
history, not market predictions. Complements `/predict`: that forecasts the
market with gradient-boosted trees, this analyses the trader with a language
model.

Sandbox-only. Nothing here feeds the dashboard, analytics, or P&L.

## The core design rule

**The model never does arithmetic.**

Every number that appears in a coach report is computed in TypeScript by
[`src/lib/coach/facts.ts`](../src/lib/coach/facts.ts) from Prisma rows. The
model receives that finished fact sheet and is asked to _interpret_ it —
find patterns, rank them, suggest changes. It is explicitly instructed to
copy figures verbatim and never derive new ones.

This is what makes it safe to render an LLM's output next to real P&L. A
model asked to "analyse these trades" will confidently invent an average
holding time; a model handed `avgHoldHoursLosers: 12.4` can only repeat it.

The `facts` payload is stored alongside every report, so any claim can be
audited against the exact numbers that produced it. The UI exposes it under
"The numbers behind this review".

## Pipeline

```
Trade[] + CashFlow[] + tags
  └─ buildCoachFacts()        deterministic, pure, unit-tested
       └─ hashFacts()         sha256 → cache key (excludes generatedAt)
            └─ buildCoachPrompt() + SYSTEM_INSTRUCTION
                 └─ Gemini generateContent (responseSchema-constrained JSON)
                      └─ coachReportSchema.safeParse()   zod, on the way in AND out
                           └─ CoachReport row
```

| File                                  | Role                                                        |
| ------------------------------------- | ----------------------------------------------------------- |
| `src/lib/coach/facts.ts`              | All metric computation. Pure, Prisma-free, no network.      |
| `src/lib/coach/schema.ts`             | The Gemini `responseSchema` and the matching zod validator. |
| `src/lib/coach/prompt.ts`             | System instruction + fact-sheet serialisation.              |
| `src/lib/coach/gemini.ts`             | REST client. Server-side only.                              |
| `src/lib/coach/report.ts`             | Orchestration + fact hashing.                               |
| `src/app/(app)/coach/actions.ts`      | Auth, persistence, caching.                                 |
| `src/components/coach/CoachPanel.tsx` | Client UI.                                                  |

## What the fact sheet measures

The metrics were chosen because they surface _behaviour_ rather than luck:

- **Hold-time asymmetry** (`loserToWinnerHoldRatio`) — the disposition effect.
  A ratio above 1 means losers are held longer than winners, the single most
  common retail failure mode.
- **Payoff ratio vs win rate** — whether a high win rate is being funded by
  a few oversized losses.
- **Revenge trades** — entries opened within 24h of realising a loss, with
  their win rate compared against the trader's baseline.
- **Sizing discipline** (`largestLossSizeVsAverage`) — whether the worst loss
  was also an outsized position.
- **Streaks**, **fee drag**, per-tag / per-direction / per-weekday buckets.
- **Recent journal notes** paired with how each trade actually turned out —
  the qualitative material that makes this a _journal_ coach.

## Why plain `fetch` instead of an SDK

No new npm dependency. This repo treats `package-lock.json` regeneration as a
hazard (two machines' npm versions produce ping-ponging diffs — see
CLAUDE.md), and `npm install` inside OneDrive is unreliable. The Gemini REST
surface is one POST, and the market-data providers already call third-party
APIs with bare `fetch`, so this stays consistent with existing conventions.

## Configuration

```bash
GEMINI_API_KEY=""    # required — https://aistudio.google.com/apikey
GEMINI_MODEL=""      # optional — defaults to gemini-flash-latest
```

Get the key from **Google AI Studio**, not Vertex AI — Vertex requires GCP
billing, AI Studio's free tier does not need a card.

`GEMINI_MODEL` exists so a specific Flash snapshot can be pinned without a
code change; the client returns a clear error naming the variable if the
configured model isn't available to your key.

**Pin a specific snapshot at your own risk.** The default was originally
`gemini-2.5-flash`, a hardcoded snapshot name — Google deprecated it for new
accounts, and `generateContent` started 404ing even though `ListModels` kept
listing it (the error message names the model and points at a newer one).
The default is now `gemini-flash-latest`, Google's alias that always tracks
their current recommended Flash model, so this class of failure shouldn't
recur for the default. If you set `GEMINI_MODEL` to a pinned snapshot instead
(e.g. for reproducibility), that snapshot can go the same way later — the
fix is switching it to a current name, not a code change.

**Restart the dev server after adding the key.** Next.js hot-reloads source
but never re-reads `.env*` in a running process.

Without a key, `/coach` still renders and shows a setup notice rather than
crashing — same graceful-degradation rule as the market-data surfaces.

## Free-tier caveats

- **Quotas are per-account.** Check yours at
  <https://aistudio.google.com/rate-limit>. A report is one request, and
  identical history reuses the cached report, so normal use is far below any
  limit. A 429 surfaces as "rate limit reached — wait a minute", and is
  deliberately **not** retried — retrying a quota error makes it worse.
- **503 "model is overloaded" is common and transient.** Google-side capacity,
  unrelated to the key. The client retries up to 3 times (0.8s, 2s backoff),
  then falls back to a second model — `gemini-flash-lite-latest` by default,
  overridable with `GEMINI_FALLBACK_MODEL` — because a different model is a
  different capacity pool. The fallback also rescues a retired pinned snapshot,
  since a 404 moves down the chain instead of ending the call.
- **The whole call is budgeted to 55s** with 25s attempts, so retries and the
  fallback fit inside the hosting function limit. `/coach` sets
  `maxDuration = 60`; without it Vercel kills the function at its 10s default
  and a slow generation dies as an opaque platform error.
- **Before a demo, generate a report and leave the trades alone.** Unchanged
  history is a cache hit that never calls Gemini, so the demo path can't fail
  on capacity. Editing or deleting a trade changes the fact sheet hash and
  invalidates it — prune first, generate second.
- **Google may use free-tier content to improve their products.** The paid
  tier does not. A coach report sends trade metrics and journal-note excerpts.
  For the graded demo this is moot when running against seeded demo data; be
  deliberate before pointing it at real trade history.

## Caching

A report is keyed by `factsHash` — a sha256 over the fact sheet with
`generatedAt` removed. Re-running with unchanged history returns the stored
report (`reused: true`) instead of calling the API. "Regenerate" forces a
fresh call. This bounds both quota use and latency.

## Prompt-injection posture

Journal notes and tag names are user-authored free text that flows into the
prompt. The system instruction tells the model to treat those fields strictly
as data. The blast radius is small by construction: output is constrained to
a fixed JSON schema, validated by zod, and rendered only to the author of the
notes. There is no tool use and no side effect beyond writing one row.

## Testing

- `tests/unit/coach-facts.test.ts` — every metric, including the break-even
  rule, soft-deleted exclusion, null-vs-zero semantics, and payload caps.
- `tests/unit/coach-report.test.ts` — hash stability, zod validation, and a
  consistency check that the Gemini `responseSchema` and the zod schema
  describe the same shape.

The network call itself is not unit-tested; it is exercised manually.
