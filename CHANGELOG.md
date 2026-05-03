# Changelog

All notable changes to this project will be documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Soft delete on `Trade` (`deletedAt`) — paired with an Undo toast on the trade detail page.
- `TradeRevision` table — append-only audit log of edits to entry/exit prices, quantity, direction, and dates. Surfaced as "Edit history" on the trade detail page.
- New indexes on `Trade(userId, assetType)` and `Trade(userId, deletedAt)`.
- `User.timezone` column (nullable) — captures user's IANA timezone for server-side date rendering.
- Manual SQL files: `prisma/manual_constraints.sql` (CHECK constraints), `prisma/rls_policies.sql` (RLS policies).
- Privacy & legal: `/privacy`, `/terms` pages; `public/robots.txt` with `Disallow: /`; `noindex` meta tag.
- Account actions: data export (`GET /api/export`), account deletion (Supabase admin + Prisma cascade) in Settings.
- Error handling: `error.tsx`, `not-found.tsx`, `global-error.tsx`; Sonner toast provider; Vercel Analytics.
- Sentry integration: `@sentry/nextjs` with `instrumentation.ts`, client/server/edge configs, source-map upload via `withSentryConfig`.
- Security headers in `next.config.mjs`: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS.
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
- `deleteTrade` now soft-deletes (sets `deletedAt`) instead of removing the row.
- `updateTrade` writes to `TradeRevision` for any change to tracked fields.
- All Trade list/find queries now filter `deletedAt: null`.
- CSP header is intentionally not set yet — needs per-environment tuning for Supabase + Google OAuth.

### Deferred
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
