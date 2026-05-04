# CLAUDE.md

## Project

TradeLog — a full-stack trading diary/logger for a small group of friends. Log trades across stocks, crypto, and forex. Private by default, with optional sharing.

## Handoff to next session

_Last updated 2026-05-04 (end of session). **Phase 4 What-if mode is built but the migration is NOT yet applied to Supabase** — `/playground` will throw at runtime until you run `npx prisma migrate deploy`. DCA mode (the second tab in the spec) is still unbuilt._

### Where we are

- Phase 4 §4.1 What-if mode is **code-complete** on disk. New `/playground` route, server actions, panel component, snapshot CRUD, and 6 new unit tests. Sidebar entry no longer "soon"-disabled.
- **Migration `20260504000000_phase4_sim_snapshot` is on disk but UNAPPLIED.** Loading `/playground` without applying it will throw on the `simSnapshot.findMany` call. Run `npx prisma migrate deploy` once before browser-testing.
- DCA mode is **not built**. Spec wants a second tab on `/playground` — see `~/.claude/plans/hidden-gathering-kite.md` § 4.1.
- `npx tsc --noEmit` clean, `vitest` 32/32 pass (was 26 + 6 new for the simulator), `next lint` clean.

### What shipped this session (2026-05-04), in order

1. Schema: new `SimSnapshot` model + `SimKind` enum (`WHAT_IF` | `DCA`) on `prisma/schema.prisma`. `User.simSnapshots` back-relation. Migration `20260504000000_phase4_sim_snapshot/migration.sql` written by hand (additive — new table + enum, no touched columns).
2. Pure simulator math at `src/lib/playground.ts`: `pickCandleAt()` (snap-to-nearest bar) + `simulateWhatIf()` (returns `{buyPrice, sellPrice, shares, saleValue, pnl, pnlPct}`). No Prisma, no provider — easy to test.
3. Validator: `whatIfFormSchema` in `src/lib/validators.ts`. Cross-field rule rejects `sellDate < buyDate`; empty `sellDate` means "now."
4. Server actions at `src/app/(app)/playground/actions.ts`: `runWhatIf` (resolves AssetSymbol via cache or fresh provider lookup → `getCandles` with ±2 day padding for weekend snapping → `simulateWhatIf`), `saveWhatIfSnapshot`, `deleteSnapshot`. JSON columns cast through `Prisma.InputJsonValue`.
5. UI: `WhatIfPanel.tsx` (client) — TickerAutocomplete filtered by asset-type select, buy amount/date, sell date with "Use today" checkbox, result stats grid, and the existing `TradeChart` reused for entry/exit marks. `SnapshotsList.tsx` renders saved scenarios with delete buttons. Page at `src/app/(app)/playground/page.tsx` server-renders the snapshot list.
6. Nav: `disabled: true` removed from the Playground entry in `src/components/layout/nav.ts`.
7. Tests: `tests/unit/playground.test.ts` covers the spec's "buy at close, sell at close, P&L matches by hand" scenario plus weekend-snap, null-sellDate (latest candle), empty series, zero buy-amount.

### Phase 4 status

- §4.1 What-if ✅ code-complete (migration unapplied)
- §4.1 DCA ❌ not started
- "Sandbox" banner on the page is rendered as a subheader subtitle ("Sandbox — none of this affects your portfolio"). Spec called for a more prominent banner — fine to leave as-is unless user disagrees.

### Known limits I deliberately didn't paper over

- Crypto what-if works keyless via CoinGecko, but its `/ohlc` endpoint caps daily history at 365 days on free tier. Older buy dates will fail.
- Stocks/forex what-if surfaces "Historical data unavailable. Finnhub's free tier doesn't expose historical candles for stocks/forex" — same gap that already affects `/trades/[id]` and `/positions/[id]?tab=chart`. Not a regression; documented in the error string itself.
- The chart reuses `TradeChart` and always passes `direction: "LONG"` for the marks (what-if doesn't model shorts in v1).

### Suggested first message of next session

_"Apply the Phase 4 migration to Supabase, then add DCA mode to /playground."_

(After `npx prisma migrate deploy`, the existing What-if scenario is browser-testable end-to-end. DCA spec lives at `~/.claude/plans/hidden-gathering-kite.md` § 4.1 "DCA mode".)

### Repo state

Nothing has been committed since `5f67557`. Phase 2 (~50 files), all of Phase 3, all of Phase 4 What-if mode, and **four** Prisma migrations are sitting in the working tree:

- `20260427152237_hardening_phase_a/`
- `20260429113010_phase2_positions_cashflows_watchlist/`
- `20260503120000_phase3_cashflow_asset/`
- `20260504000000_phase4_sim_snapshot/` ← **NOT YET APPLIED**

User explicitly said "wait until after Phase 4" before committing.

### Don't repeat past mistakes

- **`npm run dev` does NOT re-read `.env*` files.** If you change env vars (project ref, DB URL, OAuth keys, provider API keys), kill the dev server and restart. Symptom from 2026-04-30: login looked like it "downloaded something and loaded forever" because client and server were using different Supabase URLs.
- New project ref is `jxlmdplmpykendthmjpy` (Frankfurt). Old is `xcmtplfqeqltsmuftooj` (Seoul). Verify with `grep -E "SUPABASE|DATABASE_URL|DIRECT_URL" .env`.
- `.env.local` has a `DATABASE_URL` override pointing at the EU **session-mode** pooler (port 5432, no `pgbouncer=true`). Intentional for dev speed — don't normalize it.
- Direct DB connection (`db.jxlmdplmpykendthmjpy.supabase.co:5432`) is **IPv6-only on this project**. For migrations or `psql`, use the session pooler at `aws-1-eu-central-1.pooler.supabase.com:5432` — that's already what `DIRECT_URL` points to. Don't try to swap to the `db.*` form.
- `requireUser` is wrapped in React `cache()`. Calling it from layout + page + actions shares a single DB roundtrip per request. **Don't undo the cache wrapper.**
- The marketdata module is server-side only — never import `src/lib/marketdata/*` from a client component. It depends on `process.env.FINNHUB_API_KEY` that mustn't ship to the browser.
- The trades-table row click handler is JS-based, not `<Link className="absolute inset-0">` inside the `<tr>`. **Don't "simplify" it back to the Link form** — `position:relative` on `<tr>` is ignored by some browsers, which makes the Link's containing block the viewport and breaks every click on the page.
- `Sidebar` uses `sticky top-0 h-screen` on the `<aside>` so the avatar footer stays in viewport on long pages. Don't remove unless you replace with another full-height pattern.
- `PRISMA_DEBUG=1` is the diagnostic of choice for any future perf work — don't remove the logging branch in `src/lib/prisma.ts`.

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

**Phase 4 — Playground: What-if mode shipped 2026-05-04 (migration unapplied as of end-of-session).** DCA mode still unbuilt. New: `SimSnapshot` model, `src/lib/playground.ts` (pure simulator), `src/app/(app)/playground/{page,actions}.ts`, `src/components/playground/{WhatIfPanel,SnapshotsList}.tsx`, `whatIfFormSchema` in validators. Reuses `TradeChart` + `TickerAutocomplete`; no new design primitives. See `~/.claude/plans/hidden-gathering-kite.md` for the DCA half of the spec.

### Caveats

- `FINNHUB_API_KEY` is set in `.env` and verified working as of 2026-05-03. `COINGECKO_DEMO_API_KEY` is optional — crypto works keyless on free tier.
- After adding any provider key, **kill and restart `npm run dev`** — Next.js hot-reloads source but never re-reads `.env*` files in a running process.
- **Phase 4 migration `20260504000000_phase4_sim_snapshot` is unapplied.** `/playground` will throw on `simSnapshot.findMany` until you `npx prisma migrate deploy`.
- Dividend yields are pulled lazily from Finnhub the first time a stock appears on `/analytics` and cached on `AssetSymbol` for 7 days. If the page renders with "No dividend yields cached yet", refresh in a minute (Finnhub may have been rate-limited).

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
