# Changelog

All notable changes to this project will be documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Phase 5 — Predict (ML direction forecast, course מסלול 2).** New `/predict` page: XGBoost probability that any ticker closes higher after one day / one week, with per-user prediction history that lazily resolves against live quotes and scores HIT/MISS. Models are trained offline in Python (`ml/train.py`, 14 assets since 2020, chronological split) and served by a pure-TypeScript tree evaluator (`src/lib/ml/`) — float32 split semantics, NaN-as-missing, measured intercept; golden vectors exported by the trainer pin Python↔TS parity in the unit suite. New `Prediction` table (migration `20260719130000_phase5_predictions`, RLS policy added), `predictions` nav entry, honest in-UI model card (test AUC ≈ 0.53 vs base rate, fee-aware backtest table). Research deliverable: `ml/tradelog_prediction.ipynb` — full Colab notebook (EDA, on-chain + macro + optional Google Trends alternative data, XGBoost vs LSTM, backtest with fees) + `ml/README.md` + `ml/requirements.txt`. Docs: `docs/ml-prediction.md`. 35 new unit tests (109 total), 3 new e2e specs (11 total); live BTC flow browser-verified end-to-end.
- Shared `resolveSymbol` helper extracted to `src/lib/marketdata/resolve.ts` (was private to the Playground actions; now also used by Predict).
- Documentation suite under `docs/`: architecture, data model, market data, portfolio math, testing, prerequisites, running-locally (+ index). README rewritten around it.
- 34 new unit tests (74 total): `stats.ts` and `positions.ts` suites (previously untested), `computeDashboardSeries`, MWR positive-rate scenario, dividend/fee cash-on-hand signs, DCA/what-if edge cases, and the four untested Zod schemas.

### Fixed

- **Sorting trades by P&L (or exit date) surfaced open trades first** — Postgres puts nulls first on `desc`, so "biggest winners" started with rows that have no P&L yet. Sort now pins nulls last in both directions.
- **`/api/health` was behind the auth redirect** — probes got a 200 login page instead of the DB liveness JSON. Added to the middleware's public paths.
- **E2E suite restored to green (8/8)** — assertions still targeted the Phase 1 UI ("Welcome back" heading, Best/Worst Trade cards, `<select>` filters), one dialog handler was registered twice, and the test-user lifecycle was broken: teardown deleted only the Supabase auth user, stranding the app's `users` row (no FK links the two schemas), which crashed the next run's `requireUser()` upsert on the unique email. Setup now cleans orphaned rows; teardown deletes the app row first.
- **Win rate counted break-even trades as wins** — `computeStats` used decimal.js `isPositive()`, which is true for +0; a scratch trade inflated `winningTrades` and win rate. Now `gt(0)`/`lt(0)`.
- **Dashboard flow markers mixed up same-instant cash flows** — `computeDashboardSeries` looked flows up by timestamp, so two flows at the same instant both rendered the last one's type. The originating `CashFlow` now travels on the timeline event.
- `.gitattributes` enforcing LF line endings for all text files — without it, Windows checkouts with `core.autocrlf=true` turn the whole tree CRLF and `prettier --check .` fails on every file.

- Soft delete on `Trade` (`deletedAt`) — paired with an Undo toast on the trade detail page.
- `TradeRevision` table — append-only audit log of edits to entry/exit prices, quantity, direction, and dates. Surfaced as "Edit history" on the trade detail page.
- New indexes on `Trade(userId, assetType)` and `Trade(userId, deletedAt)`.
- `User.timezone` column (nullable) — captures user's IANA timezone for server-side date rendering.
- Manual SQL files: `prisma/manual_constraints.sql` (CHECK constraints), `prisma/rls_policies.sql` (RLS policies).
- Privacy & legal: `/privacy`, `/terms` pages; `public/robots.txt` with `Disallow: /`; `noindex` meta tag.
- Account actions: data export (`GET /api/export`), account deletion (Supabase admin + Prisma cascade) in Settings.
- Error handling: `error.tsx`, `not-found.tsx`, `global-error.tsx`; Sonner toast provider.
- Security headers in `next.config.mjs`: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control. (HSTS is added by the Vercel platform, not by app config.)
- Mobile basics: `manifest.json`, `icon.svg`, `theme-color` meta, viewport meta.
- Code quality: `.prettierrc`, `.editorconfig`, `.nvmrc`, `engines` field, husky + lint-staged pre-commit hook.
- Testing: Vitest + React Testing Library + jsdom; unit tests for `calcPnL`, formatters, and `tradeFormSchema`.
- CI: `.github/workflows/ci.yml` (lint, typecheck, format check, test, build, audit); `.github/dependabot.yml`.
- Docs: `CONTRIBUTING.md`, `LICENSE` (MIT), this `CHANGELOG.md`.
- CSV export: `GET /api/export/csv`, plus button in Settings.
- Timezone capture: `<TimezoneCapture />` mounted in the (app) layout — fires once on first visit when `User.timezone` is null, persists IANA timezone via `captureTimezone` server action.
- `/api/health`: pings Prisma with `SELECT 1`, returns 503 with error message on failure.
- Prisma seed (`prisma/seed.ts`): generates a seed user and 30 sample trades; wired via `prisma.seed` in `package.json`.
- Bundle analyzer: `@next/bundle-analyzer` + `npm run analyze` script.
- Dashboard `EquityCurve` lazy-loaded via `next/dynamic` to keep recharts out of the initial bundle.

### Changed

- `vitest.config.ts` renamed to `vitest.config.mts` — forces Vite's ESM config loader; the CJS fallback path crashes with `ERR_REQUIRE_ESM` since `std-env@4` went ESM-only.
- `engines.node` tightened from `>=20` to `>=20.19` — the first Node 20 release with `require(esm)` enabled by default, which vitest 4 / jsdom's dependency chain needs. CI already resolved latest Node 20 and was unaffected.
- `SETUP.md` refreshed: `prisma migrate deploy` for fresh clones, complete env var list (test auth + market data), pointer to the authoritative `prisma/rls_policies.sql`.
- `CHANGELOG` corrected: Sentry, Vercel Analytics, and HSTS were listed as shipped but were never integrated — moved to Deferred / clarified.
- `deleteTrade` now soft-deletes (sets `deletedAt`) instead of removing the row.
- `updateTrade` writes to `TradeRevision` for any change to tracked fields.
- All Trade list/find queries now filter `deletedAt: null`.
- CSP header is intentionally not set yet — needs per-environment tuning for Supabase + Google OAuth.

### Deferred

- Sentry error tracking — `.env.local.example` reserves the env vars, but `@sentry/nextjs` is **not** installed or wired yet.
- Vercel Analytics — considered during hardening, not integrated.
- React Hook Form refactor of `TradeForm` — current uncontrolled-form UX is good enough.
- PostHog product analytics — Vercel Analytics handles web vitals; PostHog can come back when there's a question to answer.
- Next.js 14 → 16 upgrade — `npm audit` flags 4 high-severity issues all resolved by upgrading. Major version, defer until tested.
- `favicon.ico` and `apple-touch-icon.png` — referenced in metadata but binary files need to be added.
- CSV import — column mapping UI for broker exports. Generic CSV parsing is straightforward but each broker's format differs; ship when there's a target user.
- Email notifications (Resend/Postmark) — no transactional emails yet.

## [0.1.0] — 2026-04-26

### Added

- Initial MVP scaffolding: Next.js 14 App Router, Supabase Auth (Google OAuth), Prisma + PostgreSQL.
- Core models: User, Trade, Tag, TradeTag, TradeImage.
- Pages: dashboard, trade log, trade create/edit/detail, settings, login.
- Components: TradeForm, TradesTable, TradeFilters, EquityCurve, StatsCard.
- Dark theme with Tailwind.
- Playwright E2E setup.
