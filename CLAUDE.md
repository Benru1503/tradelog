# CLAUDE.md

## Project

TradeLog — a full-stack trading diary/logger for a small group of friends. Log trades across stocks, crypto, and forex. Private by default, with optional sharing.

## Handoff to next session

_Last updated 2026-05-04 (end of session). **Phase 4 is fully shipped** — both What-if and DCA modes live, migration applied, all work committed and pushed to `main`. Three commits since `5f67557`: `9d1e228` (Phase 4 + Phase 3 dividend polish), `e1ebd34` (repo-wide prettier pass), `d3cd70b` (positions-table row-click fix)._

### Where we are

- Phase 4 §4.1 **What-if + DCA both ship**. `/playground` has a tab switcher (`PlaygroundTabs.tsx`); DCA uses XIRR-based CAGR, a Recharts ComposedChart (Area for value, dashed step Line for cumulative invested), and persists snapshots without the per-candle series (reproducible from params).
- **All four Prisma migrations are applied to Supabase** — including `20260504000000_phase4_sim_snapshot`. No pending DDL.
- Demo data is seeded on Ben's account via `scripts/seed-ben-demo.ts` — 15 trades, 8 cashflows, 8 tags, 4 watch items, 2 sim snapshots, 14 cached AssetSymbols with sectors, 2 trade revisions. Idempotent: gated by a `[demo]` marker in `notes`. To wipe: delete trades/cashflows where notes/note `contains "[demo]"`.
- `npx tsc --noEmit` clean, `npx next lint` clean, `vitest` 40/40 pass, `prettier --check .` clean.
- CI is green on `main` for the build job. **The audit job is red and that's pre-existing**: 5 npm advisories (1 moderate, 4 high) all chained to Next.js — fix is `next@16.2.4`, a major-version upgrade. The workflow has `continue-on-error: true` on the audit step so it doesn't gate the run, but it does light up red in the UI and trigger failure emails.

### What shipped this session (2026-05-04)

1. **DCA mode** — `simulateDca()` and `xirr()` in `src/lib/playground.ts` (bisection-based annualized rate over the contribution + final-value cash flows). New validator `dcaFormSchema`. Server actions `runDca` / `saveDcaSnapshot` in `src/app/(app)/playground/actions.ts`. UI: `DcaPanel.tsx`, `PlaygroundTabs.tsx`. Polymorphic `SnapshotRow { kind, summary, ... }` so the saved-snapshots list renders both What-if and DCA rows in one panel.
2. **Migration applied** — ran `npx prisma migrate deploy`, all four migrations now live on Supabase.
3. **Demo seed** — `scripts/seed-ben-demo.ts`. Run via `npx tsx scripts/seed-ben-demo.ts`. Hardcodes Ben's user UUID `40bfe2c9-661a-4f2a-921b-9e8f4b8a5144`.
4. **Repo-wide prettier pass** — first push failed CI because `prettier --check .` ran against 81 unformatted files (mostly pre-existing). Fixed in `e1ebd34`.
5. **PositionsTable row-click bug** — same `<tr>` + `position:relative` quirk that hit TradesTable: the `<Link className="absolute inset-0">` overlay covered the viewport and intercepted every click after the first, sending users into the last-rendered row's position (ETH). Replaced with `onClick`/`onKeyDown` JS handler in `d3cd70b`.

### Suggested first message of next session

_"Browser-test /playground end-to-end (try BTC for both What-if and DCA), then pick the next feature."_

The What-if + DCA panels work in the abstract (40/40 tests, type/lint clean) but neither has been driven through a browser. Crypto via CoinGecko keyless is the golden path; stocks/forex will surface a graceful "Historical data unavailable" message because Finnhub free tier doesn't ship `/stock/candle`.

### What's left in the spec (not in any active phase)

- **Phase 3 §3.3 — 30-day allocation drift.** Needs a daily position-snapshot job (cron / Vercel Scheduled Function). Deferred.
- **Multi-currency cash flows.** Schema has `currency` already; UI/aggregation is USD-only.
- **Watchlist alert delivery** (email / push). Visual "target hit" pill works; no notifications.
- **Friend-only filter on `/shared`.** Spec flagged it as small QoL, not phased.
- **Sandbox banner.** Currently a page subtitle; spec wanted a more prominent banner. Fine to leave unless user disagrees.
- **Next.js audit upgrade** (next@14 → next@16.x). High-severity DoS / HTTP-smuggling / cache-growth advisories. Major-version bump with breaking changes — needs an isolated session.

### Don't repeat past mistakes

- **`npm run dev` does NOT re-read `.env*` files.** If you change env vars (project ref, DB URL, OAuth keys, provider API keys), kill the dev server and restart. Symptom from 2026-04-30: login looked like it "downloaded something and loaded forever" because client and server were using different Supabase URLs.
- New project ref is `jxlmdplmpykendthmjpy` (Frankfurt). Old is `xcmtplfqeqltsmuftooj` (Seoul). Verify with `grep -E "SUPABASE|DATABASE_URL|DIRECT_URL" .env`.
- `.env.local` has a `DATABASE_URL` override pointing at the EU **session-mode** pooler (port 5432, no `pgbouncer=true`). Intentional for dev speed — don't normalize it.
- Direct DB connection (`db.jxlmdplmpykendthmjpy.supabase.co:5432`) is **IPv6-only on this project**. For migrations or `psql`, use the session pooler at `aws-1-eu-central-1.pooler.supabase.com:5432` — that's already what `DIRECT_URL` points to. Don't try to swap to the `db.*` form.
- `requireUser` is wrapped in React `cache()`. Calling it from layout + page + actions shares a single DB roundtrip per request. **Don't undo the cache wrapper.**
- The marketdata module is server-side only — never import `src/lib/marketdata/*` from a client component. It depends on `process.env.FINNHUB_API_KEY` that mustn't ship to the browser.
- **Never use `<Link className="absolute inset-0">` inside a `<tr>`** for row navigation. `position:relative` is silently ignored on `<tr>` in many browsers; the Link's containing block becomes the viewport, the overlay covers the whole page, and every click after the first lands on whichever was the last-rendered row. Hit twice already (TradesTable, PositionsTable). Use `onClick`/`onKeyDown` on the `<tr>` with `role="link"`/`tabIndex={0}` — see `TradesTable.tsx` and `PositionsTable.tsx` for the canonical pattern. Fine on `<li>`/`<div>`, only `<tr>` is the trap.
- `Sidebar` uses `sticky top-0 h-screen` on the `<aside>` so the avatar footer stays in viewport on long pages. Don't remove unless you replace with another full-height pattern.
- `PRISMA_DEBUG=1` is the diagnostic of choice for any future perf work — don't remove the logging branch in `src/lib/prisma.ts`.
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
