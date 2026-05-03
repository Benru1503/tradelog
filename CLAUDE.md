# CLAUDE.md

## Project

TradeLog — a full-stack trading diary/logger for a small group of friends. Log trades across stocks, crypto, and forex. Private by default, with optional sharing.

## Handoff to next session

_Last updated 2026-05-03 (mid-session, live) — see "In flight" below for live status of work this session. If you're resuming because the previous session ran out of tokens, start by reading "In flight"._

### In flight (this session, 2026-05-03)

Token budget is tight, so this section is updated **as work happens**, not just at session end.

**Done this session (in order):**
1. ✅ Reconciled handoff with disk state — marketdata module had been built Apr 30 evening but the prior handoff didn't reflect it. Caveats updated.
2. ✅ Shipped Phase 3 §3.1 — in-trade price chart on `/trades/[id]` and `/positions/[id]?tab=chart`. New files: `src/lib/marketdata/candles.ts`, `src/components/trades/TradeChart.tsx`. Provider methods added to Finnhub + CoinGecko. Note: Finnhub's free tier doesn't expose `/stock/candle` so stock charts show a graceful "Historical OHLC requires paid tier" message; crypto charts work keyless.
3. ✅ User added `FINNHUB_API_KEY` to `.env`. Verified working with curl (HTTP 200, real AAPL quote). User still needs to start the dev server to see live prices flow.
4. ✅ Wrote `~/Downloads/finnhub-setup.md` — step-by-step key setup guide.
5. ✅ Bug fix: watchlist target price was effectively required (cross-field validator demanded both price+direction or neither). Now: price without direction → error, direction without price → silently dropped. Files: `src/lib/validators.ts`, `src/app/(app)/watchlist/actions.ts`, `src/components/watchlist/WatchItemModal.tsx`.
6. ✅ Bug fix (significant): every click on `/trades` was navigating to a single trade. Root cause: `<Link className="absolute inset-0">` inside a `<tr position:relative>` — `position:relative` on `<tr>` is implementation-defined per CSS spec, and when the browser ignores it the Link's containing block becomes the **viewport**, covering the entire page including the sidebar. Replaced with JS-based clickable row (`onClick`/`onKeyDown`/`role="link"`/`tabIndex={0}`). File: `src/components/trades/TradesTable.tsx`. **Don't ever revert to the absolute-Link-on-tr pattern.**

**Done this session (continued):**
7. ✅ Shipped Phase 3 §3.2 sector heatmap + §3.3 current-allocation donut on a new `/analytics` page. Files added/modified:
   - `src/app/(app)/analytics/page.tsx` (new)
   - `src/components/analytics/SectorHeatmap.tsx` (new) — Recharts Treemap, tile size = allocation, color = unrealized P&L %, click drills into the position
   - `src/lib/marketdata/sectors.ts` (new) — backfills `AssetSymbol.sector` for stocks via Finnhub `/stock/profile2` (free tier supports it)
   - `src/lib/marketdata/providers/finnhub.ts` — `getIndustry` method
   - `src/components/layout/nav.ts` — Analytics no longer `disabled: true`
   - Crypto/forex bucket as "Crypto" / "Forex" since they don't have sectors. Stocks without sector fall back to "Stocks (other)" until profile2 fills them in.
   - **Deferred:** 30-day allocation drift (§3.3 second half). Needs daily position snapshots we don't capture yet — a scheduled job to write a `PositionSnapshot` row each day, then a side-by-side donut comparison. Page already shows a small footer note explaining this.

**Done this session (continued):**
8. ✅ Shipped Phase 3 §3.5 (most of it) — dividend tracking.
   - Confirmed `CashFlowModal` already supports `DIVIDEND` and `AddMenu` already exposes the "Dividend" entry. **No code change needed** — recording dividends has been working since Phase 2 shipped.
   - Added a green "Dividends in window" chip to `/trades/[id]` showing the **account-wide** sum of `CashFlow` rows of type `DIVIDEND` whose `occurredAt` falls inside the trade's holding period (`entryDate` → `exitDate ?? now`). Title attribute notes the asset-filter caveat.
   - File: `src/app/(app)/trades/[id]/page.tsx` (added query + chip; new `Coins` icon import).

**Done this session (continued, low-token tail):**
9. ✅ One-liner cleanup: bounded the `prisma.assetSymbol.findMany` on `/positions` to only the (asset, assetType) pairs the user actually holds (open + closed). Previously it pulled the entire prices table on every page load — fine now, but would have grown linearly with the global symbol cache. File: `src/app/(app)/positions/page.tsx` (positions are fetched first; prices follow with `where: { OR: heldPairs }`; the TODO comment is gone). Type-checks clean.
10. ✅ Doc-correctness: noticed while doing #9 that the §3.5 follow-up #2 description below is **wrong** — `AssetSymbol.dividendYield Decimal?` is already in `prisma/schema.prisma` and was shipped in `20260429113010_phase2_positions_cashflows_watchlist`. So only the `enrichStockYields()` helper + Finnhub `/stock/metric` call + the widget on `/analytics` remain; **no migration needed**.

**Phase 3 status as of end-of-session:**
- §3.1 ✅ in-trade chart
- §3.2 ✅ sector heatmap
- §3.3 ✅ current allocation donut + top-weights bar list (30-day **drift** deferred — needs daily snapshot job we don't have)
- §3.4 ✅ cash-adjusted equity curve (shipped Apr 30)
- §3.5 ⚠️ partially shipped — recording flow + holding-period chip done; **two follow-ups remain**:
  1. Tighten the chip to show **only this asset's** dividends. Requires adding `assetSymbol String?` (and probably `tradeId String?`) to the `CashFlow` model + a new migration `phase3_cashflow_asset` + an optional ticker autocomplete in `CashFlowModal` when type=DIVIDEND.
  2. "Projected annual dividend" widget on `/analytics`. Needs a yield-per-symbol fetch via Finnhub `/stock/metric?metric=all` (exposes `dividendYieldIndicatedAnnual`). **`AssetSymbol.dividendYield Decimal?` is already in the schema** (shipped in Phase 2 migration) — so just write `enrichStockYields()` paralleling `enrichStockSectors` and consume it on the analytics page. **No migration needed.**
- §3.6 ✅ top movers strip (shipped Apr 30)

**Not yet started this session:**
- Phase 4 (Playground) untouched.

**Suggested next session opener:** _"Pick up §3.5 — add `assetSymbol` to `CashFlow`, narrow the trade-detail dividend chip, and ship the projected-annual-dividend widget on /analytics."_

Or, if §3.5 polish can wait: _"Start Phase 4 — the Playground. What-if mode first."_

---

_Original (reconciled) handoff below — superseded by "In flight" above for anything that overlaps._



**Where we are:** Frankfurt Supabase project is live and fast (~70–90ms steady-state per query). Phase 3's price-independent slice (§3.4 cash-adjusted equity curve + §3.6 top movers strip) shipped Apr 30 on the dashboard. **The market-data module landed Apr 30 in the same evening and is fully wired through the app — but `.env` is missing the provider keys, so quotes return null and every live-price surface degrades to `—`.**

**What's actually built (verified on disk 2026-05-03):**

1. **Market-data router + cache + providers — `src/lib/marketdata/`.**
   - `client.ts` routes STOCK/FOREX → Finnhub, CRYPTO → CoinGecko, exposes `getMarketDataProvider()`.
   - `cache.ts` provides `getCachedPrice` / `getCachedPrices` with a 15-minute TTL, falls back to whatever stale `AssetPrice` row exists on provider failure.
   - `providers/finnhub.ts` + `providers/coingecko.ts` — both with safe-fetch wrappers (5s timeout, no-store, graceful nulls). Finnhub returns `null` when no key is set; CoinGecko works keyless on free tier.
2. **Wired downstream:**
   - `/api/tickers/search` route folds provider hits into `AssetSymbol` cache.
   - `/watchlist` consumes `getCachedPrices(symbols)`.
   - `/positions` and `/positions/[id]` decorate via `decoratePosition()` using cached prices for market value + unrealized P&L (placeholders to `—` when no price exists).
3. **Phase 3 §3.4 cash-adjusted equity curve** on `/dashboard` — `Trading P&L` | `Account Value` mode + `All` | `YTD` | `1M` | `1W` timeframe pills, deposit/withdrawal markers in Account Value mode. Powered by `computeDashboardSeries` in `src/lib/portfolio.ts`.
4. **Phase 3 §3.6 top movers strip** on `/dashboard` — `src/components/dashboard/TopMoversStrip.tsx`, winners/losers columns with `All-time` / `This month` toggle.

**Blocker / ready to unblock in 30 seconds:** `.env` has **no `FINNHUB_API_KEY` and no `COINGECKO_DEMO_API_KEY`** (lines aren't even present — `.env.local.example` has the template). Add at least Finnhub (free tier at finnhub.io, 60 calls/min) and **restart the dev server** — `.env` doesn't hot-reload. After that, `/positions`, `/watchlist`, and `/positions/[id]` will start showing real numbers without any code change.

**What's next:**

- **Add `FINNHUB_API_KEY` (and optionally `COINGECKO_DEMO_API_KEY`) to `.env`, restart `npm run dev`, eyeball `/positions` and `/watchlist`** to confirm prices flow.
- **Pause the old Seoul Supabase project on 2026-05-05** — the scheduled remote agent will remind. Routine ID `trig_01WVjTBFhABKPmDUTKG32Ug7`. Until then it stays running as the rollback safety net.
- ~~**One-liner cleanup:** unbounded `prisma.assetSymbol.findMany` on `/positions`.~~ **Done 2026-05-03 — see "Done this session" #9.**
- **Resume Phase 3 — price-dependent slice:**
  - §3.1 In-trade price chart on `/trades/[id]` and `/positions/[id]` (`lightweight-charts ^4.2.1` is installed and still unused; the Chart tab on `/positions/[id]` already exists as a Phase 3 stub at `positions/[id]/page.tsx:182-196`).
  - §3.2 Sector heatmap on `/analytics`.
  - §3.3 Distribution donut + 30-day allocation drift on `/analytics`. (Note: a `PositionDonut` already lives on `/positions` — Phase 3 needs the *drift over time* chart on the dedicated `/analytics` page, which still doesn't exist.)
  - §3.5 Dividend tracking (`DIVIDEND` `CashFlowType` already in schema; just no UI yet).
- *(Optional micro-optimization, deferred)* collapse `createTrade`'s new-position transaction path to skip `recomputePosition` since the snapshot is already known inline. Saves ~1s on POST `/trades/new`. Skip until it bothers you.
- **Phase 4 (Playground)** untouched.

**Repo state heads-up:** Nothing has been committed since `5f67557`. Phase 2 (~50 files), the hardening migration, the Phase 3 widgets, the marketdata module, and two unpushed Prisma migrations are all sitting in the working tree. Fine for a solo project, but there's no checkpoint to bisect against.

**Don't repeat past mistakes:**
- **`npm run dev` does NOT re-read `.env*` files.** If you change env vars (project ref, DB URL, OAuth keys, **provider API keys**), kill the dev server and restart. Symptom of forgetting last time: login appeared to "download something and load forever" because client and server were using different Supabase URLs. (Burned us 2026-04-30.) Same trap applies the moment you add `FINNHUB_API_KEY` — the running server won't see it.
- New project ref is `jxlmdplmpykendthmjpy` (Frankfurt). Old is `xcmtplfqeqltsmuftooj` (Seoul). Verify with `grep -E "SUPABASE|DATABASE_URL|DIRECT_URL" .env`.
- `.env.local` has a `DATABASE_URL` override pointing at the EU **session-mode** pooler (port 5432, no `pgbouncer=true`). This is intentional for dev speed — don't remove or "normalize" it.
- Direct DB connection (`db.jxlmdplmpykendthmjpy.supabase.co:5432`) is **IPv6-only on this project**. For migrations or `psql`, use the session pooler at `aws-1-eu-central-1.pooler.supabase.com:5432` — that's already what `DIRECT_URL` points to. Don't try to swap to the `db.*` form.
- `requireUser` is wrapped in React `cache()`. Calling it from layout + page + actions all share a single DB roundtrip per request. **Don't undo the cache wrapper or revert to blanket upsert.**
- The marketdata module is server-side only — never import `src/lib/marketdata/*` from a client component. It depends on `process.env.FINNHUB_API_KEY` etc. that mustn't ship to the browser.
- Phase 4 sidebar entry is still a placeholder. Phase 3's Analytics entry is still a placeholder too — only the dashboard widgets shipped, not the dedicated `/analytics` page.
- `lightweight-charts` is installed but still unused; reserved for Phase 3 §3.1 (in-trade chart).
- `PRISMA_DEBUG=1` is the diagnostic of choice for any future perf work — don't remove the logging branch in `src/lib/prisma.ts`.

**Suggested first message of next session:** _"Add my Finnhub key, restart dev, and let's confirm prices flow before we start §3.1."_

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
- **Tag:** user-scoped labels (e.g., "breakout", "earnings play") with colors.
- **TradeImage:** screenshots attached to trades via Supabase Storage.

## Current Phase

**Phase 2 — Foundations: shipped 2026-04-29** (migration `20260429113010_phase2_positions_cashflows_watchlist` applied to Supabase). Ticker autocomplete (no live provider yet), Position abstraction with averaging-up modal, cash flows + Activity ledger, Watchlist, TWR/MWR math, Tag UI.

**Phase 3 — Analytics & Visualisation: substantially shipped 2026-05-03.**
- §3.1 ✅ In-trade price chart on `/trades/[id]` and `/positions/[id]?tab=chart` (`src/components/trades/TradeChart.tsx`, `src/lib/marketdata/candles.ts`). Crypto charts work keyless via CoinGecko; stock/forex degrade gracefully because Finnhub free tier doesn't expose `/stock/candle`.
- §3.2 ✅ Sector heatmap on `/analytics` (`src/components/analytics/SectorHeatmap.tsx` — Recharts Treemap, click-through to position).
- §3.3 ✅ Current-allocation donut + top weights on `/analytics`. **Deferred:** 30-day allocation drift — needs daily position snapshot job.
- §3.4 ✅ Cash-adjusted equity curve on `/dashboard` (`computeDashboardSeries` in `src/lib/portfolio.ts`).
- §3.5 ⚠️ Recording flow + trade-detail "Dividends in window" chip done. **Deferred:** asset-filtered chip (needs `CashFlow.assetSymbol` migration) and projected-annual-dividend widget (needs Finnhub `/stock/metric` fetch + `enrichStockYields` helper — `AssetSymbol.dividendYield` column already exists).
- §3.6 ✅ Top movers strip on `/dashboard` (`src/components/dashboard/TopMoversStrip.tsx`).
- **Market-data router + cache + Finnhub/CoinGecko providers** at `src/lib/marketdata/`. Consumed by `/api/tickers/search`, `/watchlist`, `/positions`, `/positions/[id]`, `/trades/[id]`, and `/analytics`.

See `~/.claude/plans/hidden-gathering-kite.md` for the full plan and Phase 4 (Playground) scope.

### Caveats
- `FINNHUB_API_KEY` is set in `.env` and verified working as of 2026-05-03 (HTTP 200 against `/quote?symbol=AAPL`). `COINGECKO_DEMO_API_KEY` is optional — crypto works keyless on free tier.
- After adding any provider key, **kill and restart `npm run dev`** — Next.js hot-reloads source but never re-reads `.env*` files in a running process.
- Only the Phase 4 sidebar entry (Playground) is still a "soon" placeholder. Analytics is live as of this session.
- `src/app/(app)/positions/page.tsx` does an unbounded `assetSymbol.findMany` (TODO at line 43) — fine while the prices table is small, worth scoping once data grows.

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
