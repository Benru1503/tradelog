# CLAUDE.md

## Project

TradeLog — a full-stack trading diary/logger for a small group of friends. Log trades across stocks, crypto, and forex. Private by default, with optional sharing.

## Handoff to next session

_Last updated 2026-08-13. **Everything is committed and pushed; `main` is clean and CI-green.** 2026-08-12 was operational: onboarded Shahar, restored the paused Supabase project, and **found and closed a live data-exposure hole** where the public anon key could read and TRUNCATE most tables. On 2026-08-13 Shahar pushed **Phase 6 — Coach** (Gemini-powered journal review) plus a Yahoo history provider and a real auth fix, all direct to `main`. The `/privacy` page was rewritten to match reality — it had claimed Sentry (never integrated) and "we do not share your data with anyone", both false._

### Where we are

- **Phase 5 — Predict is fully built, browser-verified, and on `main`.** `/predict` serves XGBoost next-day/next-week direction calls for any ticker (crypto keyless golden path; stocks via Yahoo's keyless v8 endpoint), persists per-user predictions, lazily scores them HIT/MISS, and shows an honest model card. Live BTC D1+W1 flow driven in a real browser 2026-07-19 — result card, history rows, dedupe all verified (screenshots were in the session scratchpad).
- **Supabase project restored by Ben on 2026-07-19** (it auto-paused after ~2.5 months idle; DNS was NXDOMAIN until restore). `/api/health` verified: DB answering, ~550ms from Idan's network. **Free-tier pause trap remains**: ~1 week of inactivity pauses it again — consider a weekly keep-alive hitting `/api/health` (now public) or upgrading the project.
- **Playwright E2E is green: 11/11** (8 revived this morning + 3 new predict specs). `.env.local` present (gitignored), Chromium installed.
- **Docs suite now exists**: `docs/` (architecture, data-model, market-data, portfolio-math, testing + index), README rewritten around it, SETUP.md refreshed, CHANGELOG corrected (Sentry / Vercel Analytics / HSTS were claimed but never integrated — now listed as Deferred).
- Phase 4 §4.1 **What-if + DCA both ship**. `/playground` has a tab switcher (`PlaygroundTabs.tsx`); DCA uses XIRR-based CAGR, a Recharts ComposedChart (Area for value, dashed step Line for cumulative invested), and persists snapshots without the per-candle series (reproducible from params).
- **All seven Prisma migrations are applied to Supabase** — including `20260811120000_phase6_coach_reports`. No pending DDL. Note that the coach migration's timestamp (`20260811`) sorts _before_ `20260812000000_fk_indexes` even though it was applied after; harmless, Prisma tracks by name, but don't be confused by the ordering.
- **RLS + Data API lockdown applied 2026-08-12** (`prisma/rls_policies.sql`, run via psql on `DIRECT_URL`). Context: Supabase grants `anon`/`authenticated` full table privileges on every new table in `public` by default, so each Prisma migration silently exposed its tables to the **public** anon key. Audit found 15 positions / 8 cash_flows / 7 watch_items / 6 predictions / 2 sim_snapshots readable — and TRUNCATE-able — by anyone holding that key. Fix: revoked all `anon`/`authenticated` privileges (this app has **zero** `supabase.from()` calls — Prisma-only, so the Data API is unused), enabled RLS on all 14 tables, added owner policies for the Phase 2–5 tables, rewrote every policy to `(select auth.uid())` and `TO authenticated`. Verified: anon gets 401 on every table; the app's `postgres` role has BYPASSRLS and is unaffected.
- **`ALTER DEFAULT PRIVILEGES` is now set** so future Prisma-created tables don't re-open the hole — but re-run `prisma/rls_policies.sql` after any migration that adds a table, to enable RLS and add its policy.
- Demo data is seeded on Ben's account via `scripts/seed-ben-demo.ts` — 15 trades, 8 cashflows, 8 tags, 4 watch items, 2 sim snapshots, 14 cached AssetSymbols with sectors, 2 trade revisions. Idempotent: gated by a `[demo]` marker in `notes`. To wipe: delete trades/cashflows where notes/note `contains "[demo]"`.
- `npx tsc --noEmit` clean, `npx next lint` clean, `vitest` **133/133** pass (11 files), `prettier --check .` clean, production build clean, e2e **11/11**.
- **~~Gotcha — vitest double-counts when a worktree exists.~~ Fixed 2026-08-18.** `vitest.config.mts` now excludes `**/.claude/**`, so a bare `npm test` is correct whether or not a worktree is checked out. The old workaround (`npx vitest run --exclude "**/.claude/**"`) is no longer needed.
- **A pre-push hook runs the CI fast gates** — typecheck, format:check, lint, unit tests, about 12s. It exists because a test file using `afterEach` without importing it passed vitest (`globals: true`), eslint, and prettier, and was caught only by `tsc` — in CI, three failed runs later. If you need to bypass it: `git push --no-verify`.
- **After pulling a schema change, run `npx prisma generate` before `tsc`.** Otherwise the client is stale and typecheck reports phantom errors like `Property 'coachReport' does not exist on type 'PrismaClient'`. CI regenerates on every build so it only bites locally.
- CI is green on `main` for the build job. **The audit job is red and that's pre-existing**: 5 npm advisories (1 moderate, 4 high) all chained to Next.js — fix is `next@16.2.4`, a major-version upgrade. The workflow has `continue-on-error: true` on the audit step so it doesn't gate the run, but it does light up red in the UI and trigger failure emails.

### What shipped 2026-08-13 (Shahar — Phase 6 Coach, pushed direct to `main`)

Three commits, `b5a81ca..cf5451b`, reviewed after the fact. All green: 133 tests, tsc clean, CI green.

1. **Phase 6 — Coach** (`5304f07`) — `/coach` runs a Gemini review of the user's trade journal. Architecture worth preserving: **all numbers are computed server-side in `src/lib/coach/facts.ts` and the model only interprets them** — it is explicitly forbidden from doing arithmetic, which is what makes the output safe to show beside real P&L. The system instruction in `prompt.ts` also carries a prompt-injection guard telling the model that journal notes and tag names are data, never instructions. Key is server-side only (`GEMINI_API_KEY`, no `NEXT_PUBLIC_`), sent as an `x-goog-api-key` header. Model defaults to `gemini-flash-latest`; `GEMINI_MODEL` overrides. Reports persist to `coach_reports` and the panel is **user-triggered only** — never called automatically. 24 new tests.
2. **Auth fix** (`b5a81ca`) — HTTP header values are Latin-1, so a non-ASCII display name (Hebrew, CJK, emoji) threw and took down **every** request. Now percent-encoded in `middleware.ts`, decoded in `auth.ts`. Real bug, would have hit any such user.
3. **Yahoo history provider** (`cf5451b`) — `src/lib/marketdata/providers/yahoo.ts` replaces the Finnhub candle path that never worked on the free tier, so `/playground` DCA and what-if now work for stocks/forex. Adds `/api/tickers/first-trade-date` and caps the date pickers to it.

**He handled the RLS convention correctly** — added `coach_reports` to `prisma/rls_policies.sql` with `(select auth.uid())` + `TO authenticated`, and actually ran it. Verified live: RLS on, owner policy present, **zero anon grants on the new table** — the first real-world confirmation that the `ALTER DEFAULT PRIVILEGES` fix from 08-12 holds for tables created by later migrations.

**Privacy decision made 2026-08-13:** the Coach sends asset names, P&L, dates, tags and **excerpts of free-text journal notes** to Google. The project is on Google's **free** API tier, where submitted content may be used for product improvement and human review. `/privacy` now discloses this explicitly and tells users the opt-out is simply not to use the Coach. If this ever goes multi-user for real, revisit — a paid tier or a local model would be the honest fix.

### What shipped 2026-08-12 (security + collaborator onboarding — committed & pushed, PR #14 / `cff9acc`)

1. **Closed a live data-exposure hole.** Supabase grants `anon`/`authenticated` full table privileges on every new table in `public` by default; Prisma creates its tables there, so every migration had been silently exposing them to the **public** anon key. Measured against production: anon could read 15 positions, 8 cash_flows, 7 watch_items, 6 predictions, 2 sim_snapshots, 142 asset_symbols — and held `TRUNCATE` on all of them. Not exploited (localhost-only, never deployed), but live. Fix in `prisma/rls_policies.sql`: revoked all `anon`/`authenticated` privileges, `ALTER DEFAULT PRIVILEGES` so future migrations can't reopen it (**verified empirically** with a throwaway table), RLS on all 14 tables, owner policies for the Phase 2–5 tables that never had any, every policy rewritten to `(select auth.uid())` + `TO authenticated`. Verified: anon gets 401 everywhere; app role has BYPASSRLS and is unaffected; no DML ran, row counts identical.
2. **Migration `20260812000000_fk_indexes`** — indexes the two unindexed FKs (`trade_images.tradeId`, `trade_tags.tagId`). Applied to Supabase and on `main`.
3. **Deliberately NOT actioned:** the advisor's two "Unused Index" warnings on `trades`. Every index there reports 0 scans _including `trades_pkey`_ — Postgres seq-scans a 16-row table regardless, so that stat measures table size, not index value.
4. **Shahar onboarded** — `ShaharNavian`, write access, accepted. Sent the app credentials with `SUPABASE_SERVICE_ROLE_KEY` deliberately blank (so Settings→delete-account and the e2e teardown will fail for him; everything else works).
5. **Supabase restored** after another free-tier pause (DNS was NXDOMAIN again). The ~1-week idle pause trap is still unmitigated.
6. **Supabase↔GitHub integration: deliberately NOT enabled.** It expects `supabase/migrations/*.sql`; this repo is Prisma-managed with no `supabase/` dir, so it'd be inert now but would silently arm itself the day anyone runs `supabase init` — with "Deploy to production" wired to merges on `main`. Branching (the only real feature) is Pro-gated.

### What shipped 2026-07-19 afternoon (Phase 5 — Predict; now committed)

1. **Trained models** — `ml/train.py` (Python, plain-loop features mirrored 1:1 in TS): 14 assets (BTC/ETH + 12 stocks/ETFs), Yahoo v8 daily closes 2020→now, 23,812-row panel, 19 scale-free features, XGBoost d1 (441 trees) + w1 (66 trees), chronological split, early stopping. Honest metrics: test AUC ≈ 0.53, acc 51.7% vs 51.8% base. Backtest (long if p≥0.55, flat else, 10 bps): **BTC +9.7% vs −46.1% buy-hold** (sat out the crash), AAPL/SPY negative alpha — regime-dependent edge, stated as such in the UI.
2. **Artifacts** — `src/lib/ml/artifacts/{model.d1,model.w1,meta}.json` (tree dumps + measured intercepts + metrics + backtest) and `tests/unit/fixtures/ml-goldens.json`. **These four regenerate together via `python ml/train.py` — never separately.**
3. **TS inference** (`src/lib/ml/`) — `xgboost.ts` (tree walker: `Math.fround` float32 splits, NaN→missing branch), `features.ts` (finite-lookback indicators: Cutler RSI, SMA-MACD proxy, population std), `history.ts` (daily closes: CoinGecko market_chart for crypto — midnight point = previous day's close, drop partial "today"; Yahoo v8 for stocks/forex), `model.ts` (JSON imports + feature-order assert), `lifecycle.ts` (resolvesAt/direction/outcome/dedupe rules), `resolve-due.ts` (lazy HIT/MISS scoring on page view).
4. **App surface** — `Prediction` model + migration `20260719130000_phase5_predictions` (applied to Supabase), `/predict` page (holdings quick-picks, horizon select, result card, model card `<details>`, history table with outcome pills + per-user track record, delete w/ confirm), `predictFormSchema`, nav entry (Sparkles), `resolveSymbol` extracted to `src/lib/marketdata/resolve.ts` (playground now imports it).
5. **Course deliverables** (PDF מסלול 2) — `ml/tradelog_prediction.ipynb`: full Colab notebook (33 cells — EDA, on-chain blockchain.info + macro ^GSPC/^VIX/DX-Y.NYB + optional pytrends alt-data, XGB-lite vs XGB-full vs LSTM, fee-aware backtest + sensitivity, inference demo, JSON-export parity demo, limitations). Plus `ml/README.md` (Colab badge, requirement-mapping table) and `ml/requirements.txt`. **The notebook ships unexecuted — someone must Run All in Colab before submission so the graded copy has outputs.**
6. **Tests** — 35 new unit tests (109 total): `ml-features` (golden parity to 9 decimals + edges), `ml-xgboost` (end-to-end probability parity to 8 decimals vs Python, float32-boundary stump, missing-branch), `ml-lifecycle`, `predictFormSchema`. E2E: `predict.spec.ts` (3 DOM specs, no live-provider dependency) → 11/11. Live BTC D1+W1+dedupe verified via a throwaway spec (deleted after).
7. **Docs** — `docs/ml-prediction.md` (pipeline, parity contract, conventions, retraining), README + docs index + testing.md updated, CHANGELOG entry, this handoff.

### What shipped in the morning session (2026-07-19 — committed & pushed, `9b36b53..c3580f0`)

1. **Full test battery green**: tsc ✅, `next lint` ✅, `prettier --check .` ✅, vitest 74/74 ✅, production build ✅ (placeholder env vars, CI-style), **Playwright e2e 8/8 ✅** (real Supabase, after Ben restored the project).
2. **Environment fixes to get there** (all belong in the commit):
   - `.gitattributes` (new) — enforces LF; Windows checkout with `core.autocrlf=true` had turned all 144+ files CRLF and prettier failed repo-wide.
   - `vitest.config.ts` → `vitest.config.mts` (+ tsconfig include `**/*.mts`) — Vite's CJS config-loader fallback dies with `ERR_REQUIRE_ESM` (`std-env@4` is ESM-only).
   - `engines.node` `>=20` → `>=20.19` in package.json + hand-synced in package-lock (deliberately NOT regenerated — see gotchas).
3. **Docs suite** — `docs/architecture.md`, `docs/data-model.md` (mermaid ER), `docs/market-data.md`, `docs/portfolio-math.md`, `docs/testing.md`, `docs/README.md` index; README.md rewritten (badges, features, quickstart, doc links); SETUP.md refreshed (`migrate deploy`, full env list incl. TEST_AUTH_SECRET + market-data keys, RLS pointer to `prisma/rls_policies.sql`).
4. **Doc/reality corrections** — CHANGELOG claimed Sentry, Vercel Analytics, and HSTS as shipped; none exist in the code. Moved to Deferred / clarified. `.env.local.example` Sentry block marked "PLANNED — not yet integrated". Dead `/Users/Ben_Rubinovitz/...` plan-file path removed from `src/lib/portfolio.ts` comment. ~~Still open: `/privacy` claims Sentry~~ — **resolved 2026-08-13**: `/privacy` rewritten to drop the Sentry claim, add a Third-party services section, and disclose the Coach's Gemini data flow.
5. **34 new unit tests (74 total)** — new suites for `stats.ts` and `positions.ts` (both previously untested), plus `computeDashboardSeries`, MWR positive-rate, cash-on-hand dividend/fee signs, DCA/what-if edges, and the four untested Zod schemas. **They caught two real bugs, both fixed:** (a) break-even trades counted as wins — decimal.js `isPositive()` is true for +0; now `gt(0)`/`lt(0)` in `computeStats`; (b) dashboard flow markers looked up by timestamp, so two same-instant cash flows both showed the last one's type — the `CashFlow` now travels on the timeline event.
6. **`docs/prerequisites.md` + `docs/running-locally.md`** — machine checklist (with verify commands) and clone-to-running-app steps with a troubleshooting table; linked from README quickstart.
7. **E2E suite repaired and green (8/8)** — it had rotted since Phase 1: stale UI assertions ("Welcome back" heading, Best/Worst Trade cards, `<select>` filters — all redesigned in Phase 2), a double-registered dialog handler, and a real lifecycle bug: **teardown deleted only the Supabase auth user; `auth.users` and `public.users` have no FK**, so the stranded app row's unique email crashed the next run's `requireUser()` upsert ("Something broke" error boundary on /dashboard). Setup now cleans orphaned rows, teardown deletes the app row first (its FKs cascade the test data).
8. **Two more product fixes from the e2e pass** — trades sorted by P&L/exit-date now pin nulls last (Postgres `desc` put open trades above the biggest winners); `/api/health` added to middleware public paths (it redirected probes to the login page). Note: the same orphaned-row edge exists in production if an auth user is ever deleted outside the app's Settings flow and re-registers with the same email — `requireUser()` will crash. Rare, but worth a defensive fix someday.

### Suggested first message of next session

_"Let's prep the course submission: run the notebook in Colab and check off the deliverables list."_

**Nothing in the repo is half-finished.** `main` is clean, pushed, and CI-green on the build job. Pick up wherever you like.

Still open for the **course submission** (outside repo code): (a) someone runs `ml/tradelog_prediction.ipynb` in Colab top-to-bottom so the submitted copy has executed outputs; (b) the 5-page מסמך אפיון וסיכום PDF (problem, architecture, results, Risks & Caveats — `docs/ml-prediction.md` + notebook §11 are ready source material); (c) the 3–5 min demo video (`/predict` live + notebook backtest section is a natural script); (d) the survey (5% of the grade).

Smaller open items, none blocking:

- **`PROJECT_PROPOSAL.he.pdf` is one word stale.** Prettier corrected `ב_שלוש_` → `ב*שלוש*` in the Hebrew markdown (underscore emphasis doesn't work intraword, so that word was rendering with literal underscores instead of italic). `scripts/md-to-pdf.mjs` only emits styled HTML — the PDFs come from a manual browser print, so both PDFs need regenerating before submission anyway.
- **Leaked Password Protection** is still off in Supabase Auth. Dashboard toggle, not SQL. Near-moot — the app is Google-OAuth-only.
- **Supabase free-tier pause trap** — ~1 week idle and it pauses (has bitten twice). A weekly cron hitting `/api/health` (public) would fix it.
- Browser-pass `/playground` per the checklist — still never done.
- **Next.js major upgrade** (14 → 16.x) for the 5 npm advisories. Needs its own session; the audit job stays red until then but is `continue-on-error`.

### What's left in the spec (not in any active phase)

- **Phase 3 §3.3 — 30-day allocation drift.** Needs a daily position-snapshot job (cron / Vercel Scheduled Function). Deferred.
- **Multi-currency cash flows.** Schema has `currency` already; UI/aggregation is USD-only.
- **Watchlist alert delivery** (email / push). Visual "target hit" pill works; no notifications.
- **Friend-only filter on `/shared`.** Spec flagged it as small QoL, not phased.
- **Sandbox banner.** Currently a page subtitle; spec wanted a more prominent banner. Fine to leave unless user disagrees.
- **Next.js audit upgrade** (next@14 → next@16.x). High-severity DoS / HTTP-smuggling / cache-growth advisories. Major-version bump with breaking changes — needs an isolated session.

### Don't repeat past mistakes

- **Idan's machine needs a Node upgrade before dev work.** System Node is 20.13.1; the project needs ≥ 20.19 (`require(esm)` — vitest 4 / jsdom chain crashes with `ERR_REQUIRE_ESM` on older). This session used a throwaway portable Node in the scratchpad; that's gone next session. Upgrade system Node (e.g. `winget install OpenJS.NodeJS.LTS`) or install nvm-windows.
- **Don't regenerate `package-lock.json` on this machine.** Ben's npm writes `libc` metadata fields that Idan's npm strips — a full `npm install`/`--package-lock-only` produces a 60+-line cosmetic diff that will ping-pong between machines. Hand-sync trivial lock changes or let Ben/CI regenerate.
- **npm inside OneDrive is flaky.** If vitest dies with `Cannot find module './rolldown-binding.win32-x64-msvc.node'`, the optional platform binding got skipped: `npm install --no-save "@rolldown/binding-win32-x64-msvc@<rolldown version>"`. Pause OneDrive sync for big installs. (Recipe also in `docs/testing.md`.)
- **If prettier suddenly flags ~150 files on Windows**, the working tree is CRLF from a pre-`.gitattributes` checkout: `git rm --cached -r -q . && git reset --hard` (tree must be otherwise clean).
- **`npm run dev` does NOT re-read `.env*` files.** If you change env vars (project ref, DB URL, OAuth keys, provider API keys), kill the dev server and restart. Symptom from 2026-04-30: login looked like it "downloaded something and loaded forever" because client and server were using different Supabase URLs.
- New project ref is `jxlmdplmpykendthmjpy` (Frankfurt). Old is `xcmtplfqeqltsmuftooj` (Seoul). Verify with `grep -E "SUPABASE|DATABASE_URL|DIRECT_URL" .env`.
- `.env.local` has a `DATABASE_URL` override pointing at the EU **session-mode** pooler (port 5432, no `pgbouncer=true`). Intentional for dev speed — don't normalize it.
- Direct DB connection (`db.jxlmdplmpykendthmjpy.supabase.co:5432`) is **IPv6-only on this project**. For migrations or `psql`, use the session pooler at `aws-1-eu-central-1.pooler.supabase.com:5432` — that's already what `DIRECT_URL` points to. Don't try to swap to the `db.*` form.
- `requireUser` is wrapped in React `cache()`. Calling it from layout + page + actions shares a single DB roundtrip per request. **Don't undo the cache wrapper.**
- The marketdata module is server-side only — never import `src/lib/marketdata/*` from a client component. It depends on `process.env.FINNHUB_API_KEY` that mustn't ship to the browser.
- **Never use `<Link className="absolute inset-0">` inside a `<tr>`** for row navigation. `position:relative` is silently ignored on `<tr>` in many browsers; the Link's containing block becomes the viewport, the overlay covers the whole page, and every click after the first lands on whichever was the last-rendered row. Hit twice already (TradesTable, PositionsTable). Use `onClick`/`onKeyDown` on the `<tr>` with `role="link"`/`tabIndex={0}` — see `TradesTable.tsx` and `PositionsTable.tsx` for the canonical pattern. Fine on `<li>`/`<div>`, only `<tr>` is the trap.
- `Sidebar` uses `sticky top-0 h-screen` on the `<aside>` so the avatar footer stays in viewport on long pages. Don't remove unless you replace with another full-height pattern.
- `PRISMA_DEBUG=1` is the diagnostic of choice for any future perf work — don't remove the logging branch in `src/lib/prisma.ts`.
- **Prisma CLI can't see the env: there is NO `.env` file — everything lives in `.env.local`, which the Prisma CLI does not read.** Before `npx prisma migrate deploy` / `validate` on this machine, load it into the shell (strip surrounding quotes!): PowerShell loop over `Get-Content .env.local` matching `^([A-Z_][A-Z0-9_]*)=(.*)$`, trimming `"` from the value, `Set-Item env:`. Symptom otherwise: "Environment variable not found: DIRECT_URL" or P1013 "scheme not recognized" (quotes leaked into the URL).
- **The four ML artifacts regenerate together via `python ml/train.py`** — `src/lib/ml/artifacts/{model.d1,model.w1,meta}.json` + `tests/unit/fixtures/ml-goldens.json`. Never hand-edit them, never commit a subset; the `ml-features`/`ml-xgboost` vitest suites are the tripwire. Feature formulas are a **parity contract**: change `ml/train.py` and `src/lib/ml/features.ts` together or not at all (finite lookback, plain loops — no pandas `ewm`, no recursive indicators).
- **Never import `src/lib/ml/model.ts` (or the artifact JSONs) from a client component** — that's ~470KB into the browser bundle. Server components pass plain-data slices down (see `predict/page.tsx` → `ModelCardData`).
- Python 3.14 is installed system-wide (`py -3.14`). For ML work: venv **outside OneDrive**, `pip install -r ml/requirements.txt` (numpy/pandas/sklearn/xgboost is enough for `train.py`; TF is Colab-only).
- **CI runs `prettier --check .` against the whole repo.** Run `npx prettier --write .` (or set up a pre-commit hook) before pushing — a partial pass will fail the build job. The audit job will probably stay red until the Next.js major upgrade, but that's `continue-on-error: true` so it doesn't gate; the build job is the real gate.

## Tech Stack

- **Framework:** Next.js 14+ (App Router, TypeScript)
- **Database:** PostgreSQL via Supabase
- **ORM:** Prisma
- **Auth:** Supabase Auth (Google OAuth)
- **Styling:** Tailwind CSS, dark theme
- **Charts:** Recharts (stats), Lightweight Charts (price viz)
- **Storage:** Supabase Storage (trade screenshots)
- **Hosting:** Vercel + Supabase

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npx prisma migrate dev   # Run DB migrations
npx prisma generate      # Regenerate Prisma client
npx prisma studio        # Visual DB browser
```

## Project Structure

```
src/
├── app/                  # Next.js App Router pages
│   ├── (auth)/           # Auth pages (login)
│   ├── dashboard/        # Dashboard page
│   ├── trades/           # Trade log + detail pages
│   ├── shared/           # Shared feed
│   ├── settings/         # User settings
│   ├── api/              # API routes
│   └── layout.tsx        # Root layout (dark theme, sidebar)
├── components/           # Reusable UI components
│   ├── ui/               # Primitives (Button, Input, Modal, etc.)
│   ├── trades/           # Trade-specific components (TradeForm, TradeRow, etc.)
│   ├── dashboard/        # Dashboard widgets (StatsCard, EquityCurve, etc.)
│   └── layout/           # Sidebar, Header, Nav
├── lib/                  # Utilities
│   ├── supabase.ts       # Supabase client init
│   ├── prisma.ts         # Prisma client singleton
│   ├── utils.ts          # Helpers (formatCurrency, calcPnL, etc.)
│   └── types.ts          # Shared TypeScript types
├── hooks/                # Custom React hooks
└── prisma/
    └── schema.prisma     # Database schema
```

## Conventions

- Use `server actions` or API routes in `src/app/api/` for mutations — no client-side direct DB access
- All components are functional with hooks, no class components
- Use Tailwind only — no CSS modules, no styled-components
- Keep components under 150 lines; extract logic into hooks or utils
- P&L is always computed from (exitPrice - entryPrice) × quantity - fees, never manually entered
- All monetary values stored as decimals in the DB, formatted on display
- Dates stored as UTC, displayed in user's local timezone

## Key Models

- **Trade:** asset, assetType (STOCK/CRYPTO/FOREX), direction (LONG/SHORT), entryPrice, exitPrice, quantity, fees, status (OPEN/CLOSED), pnl, notes, isShared, positionId
- **Position:** groups Trade legs on the same (asset, direction) while open. Snapshots avgCost / totalQty / realizedPnl on every leg via `recomputePosition()`.
- **CashFlow:** account-level deposits / withdrawals / dividends / fee adjustments. Powers TWR/MWR so the equity curve doesn't treat a deposit as a trading gain.
- **WatchItem:** symbols a user is tracking but doesn't own yet, with optional target price + direction.
- **AssetSymbol / AssetPrice:** cached resolved tickers + latest prices from the market-data provider.
- **SimSnapshot:** saved Playground scenarios (`kind: WHAT_IF | DCA`, `params Json`, `result Json`). Sandbox-only — never read by the dashboard or analytics.
- **Prediction:** one row per /predict model run (symbol, horizon D1/W1, direction, pUp, priceAt, modelVersion, resolvesAt → lazily resolved to HIT/MISS against a live quote). Sandbox-only, like SimSnapshot.
- **CoachReport:** one row per /coach run — the structured findings Gemini returned, persisted so the page renders without re-calling the model. User-triggered only; regenerating is an explicit "force" action.
- **Tag:** user-scoped labels (e.g., "breakout", "earnings play") with colors.
- **TradeImage:** screenshots attached to trades via Supabase Storage.

## Current Phase

**Phase 2 — Foundations: shipped 2026-04-29** (migration `20260429113010_phase2_positions_cashflows_watchlist` applied to Supabase). Ticker autocomplete (no live provider yet), Position abstraction with averaging-up modal, cash flows + Activity ledger, Watchlist, TWR/MWR math, Tag UI.

**Phase 3 — Analytics & Visualisation: shipped 2026-05-03** (migration `20260503120000_phase3_cashflow_asset` applied to Supabase).

- §3.1 ✅ In-trade price chart on `/trades/[id]` and `/positions/[id]?tab=chart` (`src/components/trades/TradeChart.tsx`, `src/lib/marketdata/candles.ts`). Crypto charts work keyless via CoinGecko; stock/forex degrade gracefully because Finnhub free tier doesn't expose `/stock/candle`.
- §3.2 ✅ Sector heatmap on `/analytics` (`src/components/analytics/SectorHeatmap.tsx` — Recharts Treemap, click-through to position).
- §3.3 ✅ Current-allocation donut + top weights on `/analytics`. **Deferred:** 30-day allocation drift — needs daily position snapshot job.
- §3.4 ✅ Cash-adjusted equity curve on `/dashboard` (`computeDashboardSeries` in `src/lib/portfolio.ts`).
- §3.5 ✅ Dividend tracking — `CashFlow.assetSymbol` (new column + index), TickerAutocomplete on the Dividend modal, asset-filtered chip on `/trades/[id]`, ticker pill on Activity timeline, "Projected annual dividend" widget on `/analytics` (`src/lib/marketdata/yields.ts` + `finnhubProvider.getDividendYield`).
- §3.6 ✅ Top movers strip on `/dashboard` (`src/components/dashboard/TopMoversStrip.tsx`).
- **Market-data router + cache + Finnhub/CoinGecko providers** at `src/lib/marketdata/`. Consumed by `/api/tickers/search`, `/watchlist`, `/positions`, `/positions/[id]`, `/trades/[id]`, and `/analytics`.

**Phase 6 — Coach: shipped 2026-08-13 by Shahar (migration `20260811120000_phase6_coach_reports` applied, code on `main`).** `/coach` sends a server-computed fact sheet of the user's journal to Google Gemini and renders structured findings. `src/lib/coach/` holds `facts.ts` (all arithmetic — the model does none), `prompt.ts` (system instruction + injection guard), `gemini.ts` (REST client, server-only key), `schema.ts` (response schema), `report.ts`. UI in `src/components/coach/CoachPanel.tsx`, action in `src/app/(app)/coach/actions.ts`, persisted to `CoachReport`. Requires `GEMINI_API_KEY`; renders a setup notice without one. Write-up: `docs/coach.md`. **Sends free-text journal notes to a third party — see the privacy note in the 2026-08-13 handoff entry before extending it.**

**Phase 5 — Predict (ML, course מסלול 2): built 2026-07-19, now committed and on `main`.** XGBoost next-day/next-week direction forecasts at `/predict` for any ticker. Offline Python trainer (`ml/train.py`) exports JSON tree dumps + goldens; pure-TS server-side evaluator (`src/lib/ml/`); per-user `Prediction` rows resolve lazily to HIT/MISS. Research notebook `ml/tradelog_prediction.ipynb` (EDA, alt-data, XGBoost vs LSTM, fee-aware backtest). Full write-up: `docs/ml-prediction.md`. Sandbox-only — never feeds dashboard/analytics.

**Phase 4 — Playground: shipped 2026-05-04 (migration applied, code on `main`).** Both What-if and DCA modes live behind a tab switcher at `/playground`. Pure simulator in `src/lib/playground.ts` (`simulateWhatIf`, `simulateDca`, `xirr`, `pickCandleAt`). Server actions in `src/app/(app)/playground/actions.ts`. UI: `WhatIfPanel.tsx`, `DcaPanel.tsx`, `PlaygroundTabs.tsx`, polymorphic `SnapshotsList.tsx`. Validators `whatIfFormSchema` + `dcaFormSchema`. DCA chart is Recharts `ComposedChart` (Area for value, dashed step Line for cumulative invested). CAGR is XIRR (bisection-based money-weighted rate), not naïve final/invested. Reuses `TradeChart` + `TickerAutocomplete`; no new design primitives. Snapshots persist totals + contributions only — the per-candle series is dropped on save (reproducible from params, would bloat the row). 14 unit tests. Browser-test pass still pending.

### Caveats

- `FINNHUB_API_KEY` is set in `.env` and verified working as of 2026-05-03. `COINGECKO_DEMO_API_KEY` is optional — crypto works keyless on free tier.
- After adding any provider key, **kill and restart `npm run dev`** — Next.js hot-reloads source but never re-reads `.env*` files in a running process.
- Dividend yields are pulled lazily from Finnhub the first time a stock appears on `/analytics` and cached on `AssetSymbol` for 7 days. If the page renders with "No dividend yields cached yet", refresh in a minute (Finnhub may have been rate-limited).
- DCA on long ranges depends on candle availability: CoinGecko free tier caps daily history at ~365 days, so a 5-year monthly DCA on BTC will fail at the data-fetch step with "Historical data unavailable." Stocks/forex DCA fails entirely on Finnhub free tier (no `/stock/candle`).

## Market data

- Live (delayed) market data is fetched **server-side only**. Never call providers from the client.
- Cadence is best-effort 5–30 min; the UI must always render gracefully when prices are stale or missing (`—` placeholder, not a crash).
- Resolved symbols are cached in `AssetSymbol`; latest prices in `AssetPrice` (one row per symbol, overwritten on refresh).
- Provider choice (Finnhub / Polygon / CoinGecko) is configurable; users can supply their own API key from Settings if free-tier limits bite.

## Do NOT

- Do not fetch market data from the client — must go through a server action or API route so the provider key stays out of the browser
- Do not implement payment or subscription logic
- Do not use `any` type — always type properly
- Do not store secrets in code — use `.env.local`
- Do not create separate CSS files — Tailwind only

<!-- session-snapshot:start -->

## Recent session snapshot

_Auto-updated by the PreCompact hook. Anything between the markers is overwritten before the next compaction._

- **Timestamp:** 2026-04-29T08:43:36Z
- **Branch:** main

**Last 10 commits:**

```
5f67557 fix(auth): validate next param to prevent open redirect
1d02823 Initial commit: TradeLog Phase 1 MVP
```

**Working tree:**

```
 M .env.local.example
 M .gitignore
 M CLAUDE.md
 M README.md
 D middleware.ts
 M next.config.mjs
 M package-lock.json
 M package.json
 M playwright.config.ts
 M prisma/schema.prisma
 M src/app/(app)/dashboard/page.tsx
 M src/app/(app)/layout.tsx
 M src/app/(app)/settings/page.tsx
 M src/app/(app)/shared/page.tsx
 M src/app/(app)/trades/[id]/edit/page.tsx
 M src/app/(app)/trades/[id]/page.tsx
 M src/app/(app)/trades/actions.ts
 M src/app/(app)/trades/new/page.tsx
 M src/app/(app)/trades/page.tsx
 M src/app/api/test/login/route.ts
 M src/app/auth/callback/route.ts
 M src/app/layout.tsx
 M src/app/login/page.tsx
 M src/components/dashboard/EquityCurve.tsx
 M src/components/dashboard/RecentTrades.tsx
 M src/components/dashboard/StatsCard.tsx
 M src/components/layout/MobileHeader.tsx
 M src/components/layout/Sidebar.tsx
 M src/components/trades/DeleteTradeButton.tsx
 M src/components/trades/TradeFilters.tsx
 M src/components/trades/TradeForm.tsx
 M src/components/trades/TradesTable.tsx
 M src/components/ui/Button.tsx
 M src/components/ui/Card.tsx
 M src/components/ui/EmptyState.tsx
 M src/lib/auth.ts
 M src/lib/stats.ts
 M src/lib/supabase/middleware.ts
 M src/lib/validators.ts
 M tailwind.config.ts
 M tests/e2e/auth.setup.ts
 M tests/e2e/global-setup.ts
 M tests/e2e/global-teardown.ts
?? .claude/
?? .editorconfig
?? .github/
?? .husky/
?? .nvmrc
?? .prettierignore
?? .prettierrc
?? CHANGELOG.md
?? CLAUDE.md.tmp
?? CONTRIBUTING.md
?? LICENSE
?? files/HARDENING_PROMPT.md
?? prisma/manual_constraints.sql
?? prisma/migrations/20260427152237_hardening_phase_a/
?? prisma/migrations/20260429113010_phase2_positions_cashflows_watchlist/
?? prisma/rls_policies.sql
?? prisma/seed.ts
?? public/
?? src/app/(app)/actions.ts
?? src/app/(app)/activity/
?? src/app/(app)/cashflows/
?? src/app/(app)/positions/
?? src/app/(app)/settings/actions.ts
?? src/app/(app)/tags/
?? src/app/(app)/watchlist/
?? src/app/api/export/
?? src/app/api/health/
?? src/app/api/test/whoami/
?? src/app/api/tickers/
?? src/app/error.tsx
?? src/app/global-error.tsx
?? src/app/not-found.tsx
?? src/app/privacy/
?? src/app/terms/
?? src/components/TimezoneCapture.tsx
?? src/components/activity/
?? src/components/cashflows/
?? src/components/layout/nav.ts
?? src/components/positions/
?? src/components/settings/
?? src/components/tags/
?? src/components/ui/Avatar.tsx
?? src/components/ui/DirectionBadge.tsx
?? src/components/ui/FilterChip.tsx
?? src/components/ui/Logo.tsx
?? src/components/ui/Modal.tsx
?? src/components/ui/PageHeader.tsx
?? src/components/ui/StatusPill.tsx
?? src/components/ui/TickerAutocomplete.tsx
?? src/components/watchlist/
?? src/lib/marketdata/
?? src/lib/portfolio.ts
?? src/lib/positions.ts
?? src/lib/supabase/admin.ts
?? src/middleware.ts
?? tests/unit/
?? vitest.config.ts
?? vitest.setup.ts
```

<!-- session-snapshot:end -->
