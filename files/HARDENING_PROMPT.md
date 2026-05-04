# TradeLog — Project Hardening Prompt

> Paste this into Claude Code after your MVP is functional.
> You can do it all at once or section by section.

---

## Prompt:

I have a working Next.js + Supabase + Prisma trading diary app (TradeLog). I need you to harden it with all the non-functional essentials a production project needs. Go through each area below and implement what's missing. Ask me before making big architectural changes — for small stuff, just do it.

### 1. Security

- **Environment variables:** Audit all secrets — nothing hardcoded. Ensure `.env.local` is in `.gitignore`. Add a `.env.example` with placeholder values for every required var.
- **Input validation:** Add Zod schemas for every API route / server action input. Validate on the server, never trust the client.
- **SQL injection:** Confirm we're only using Prisma parameterized queries — no raw SQL anywhere.
- **XSS protection:** Sanitize any user-generated content (trade notes) before rendering. Ensure we're not using `dangerouslySetInnerHTML`.
- **CSRF:** Verify that Next.js server actions have built-in CSRF protection, or add it if using custom API routes.
- **Rate limiting:** Add rate limiting to auth endpoints and any public-facing API routes (use `next-rate-limit` or Supabase's built-in limits).
- **Auth guards:** Every protected page and API route must check for a valid session. Create a reusable middleware or wrapper.
- **Row-level security:** Set up Supabase RLS policies so users can only read/write their own data. Shared trades should be read-only to others.
- **Headers:** Add security headers via `next.config.js` — Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- **File upload validation:** For trade screenshots — validate file type (images only), enforce max size (5MB), and sanitize filenames before uploading to Supabase Storage.
- **Auth user deletion:** When a user deletes their account, remove the Supabase Auth user via the Admin API in addition to the Prisma cascade — otherwise an orphaned auth record remains.

### 2. Privacy & Legal

- **Privacy Policy + Terms of Service:** Add static `/privacy` and `/terms` pages. Google's OAuth consent screen requires a privacy policy URL once you go beyond test users, and you're storing PII (email, display name) plus financial trade data.
- **User data export:** A "Download my data" action in settings that returns all of the user's trades, tags, and trade images metadata as JSON or CSV.
- **Account deletion:** A "Delete account" action that removes Supabase Auth user + cascades through Trade/Tag/TradeImage. Confirm via typed confirmation ("type DELETE to confirm").
- **`robots.txt` + `noindex`:** App is private. Add `public/robots.txt` (`Disallow: /`) and `<meta name="robots" content="noindex">` in the root layout.
- **Cookie/auth disclosure:** A short note in the privacy page about Supabase auth cookies — what's stored, how long, and how to log out everywhere.

### 3. Data Integrity

- **Soft deletes on Trade:** Add `deletedAt: DateTime?` to the Trade model and filter at the query layer (`WHERE deletedAt IS NULL`) for all reads. Enables the "Undo" toast in §7. All Trade list queries, dashboard stats, and shared feed must respect this filter.
- **Audit trail on edits:** Add a `TradeRevision` table — `(id, tradeId, userId, changedAt, fieldName, oldValue, newValue)`. Write a row for every change to `entryPrice`, `exitPrice`, `quantity`, `direction`, `entryDate`, `exitDate`. Surface the history on the trade detail page as a collapsible "Edit history" section. Editing prices retroactively undermines the journal's integrity, so this is non-negotiable.
- **DB-level CHECK constraints:** Defense in depth beyond Zod. Use Prisma's raw SQL migration to add: `quantity > 0`, `entryPrice >= 0`, `exitPrice IS NULL OR exitPrice >= 0`, `fees >= 0`.
- **Migration safety:** Document a "no destructive prod migrations without a fresh backup snapshot" rule. Confirm Supabase backup retention (free tier is 7 days). Document the restore procedure.
- **Backups:** Even with Supabase's automatic backups, run a weekly `pg_dump` to a separate location (S3/local) for a small project this size. Optional but cheap insurance.

### 4. Testing

- **Unit tests:** Set up Vitest. Write tests for all utility functions (`calcPnL`, `formatCurrency`, date helpers, etc.) and Zod validation schemas.
- **Component tests:** Use React Testing Library for key interactive components — TradeForm, TradeRow, filters. Test that form validation works, required fields block submission, P&L computes correctly in the UI.
- **API / integration tests:** Test each API route / server action with mocked Prisma. Verify correct responses, auth checks, error codes.
- **E2E tests:** Set up Playwright with at least these flows:
  - Login with Google (mocked)
  - Create a trade → verify it appears in the trade log
  - Edit a trade → verify changes persist
  - Delete a trade → verify it disappears
  - Dashboard loads and shows correct stats
- **Test scripts:** Add to `package.json`:
  - `npm test` — run unit + component tests
  - `npm run test:e2e` — run Playwright
  - `npm run test:coverage` — generate coverage report

### 5. CI/CD Pipeline

- **GitHub Actions workflow** (`.github/workflows/ci.yml`):
  - On every push/PR to `main`: lint → type-check → unit tests → build
  - On merge to `main`: auto-deploy to Vercel
- **Pre-commit hooks:** Set up `husky` + `lint-staged`:
  - Run ESLint + Prettier on staged files
  - Run TypeScript type-check
  - Block commits with lint errors
- **Branch protection:** Document that `main` should have PR reviews required (I'll set this up on GitHub myself).

### 6. Error Handling, Logging & Observability

- **Global error boundary:** Add a React error boundary component that catches rendering errors and shows a user-friendly fallback UI instead of a white screen.
- **API error responses:** Standardize all API error responses to a consistent format: `{ error: string, code: string, status: number }`. Never leak stack traces or internal details to the client.
- **Toast notifications:** Add a toast system (e.g., `sonner` or `react-hot-toast`) for success/error feedback on every user action (trade created, trade deleted, upload failed, etc.).
- **Structured logging:** Server-side logs should always include `userId`, `tradeId` (when applicable), `action`, and a request ID. Use `console.error`/`console.warn` with a JSON-serializable context object — Vercel will index it.
- **Error tracking — Sentry:** Install `@sentry/nextjs`. Add `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`. Wrap `next.config.mjs` with `withSentryConfig`. Upload source maps in CI via `SENTRY_AUTH_TOKEN`. Set `tracesSampleRate: 0.1` (cheap), `replaysSessionSampleRate: 0`, `replaysOnErrorSampleRate: 1.0` (replay only on error). Add `SENTRY_DSN` to `.env.example`.
- **Product analytics — Vercel Analytics (web vitals only, for now):** Add `@vercel/analytics` and the `<Analytics />` component in root layout. Defer PostHog/funnel analytics until there's a question worth answering — premature for a 5–15 person app.
- **Uptime monitoring:** Point Better Stack / UptimeRobot at `/api/health` (see §15) — both have free tiers for one monitor.
- **404 and error pages:** Create custom `not-found.tsx` and `error.tsx` pages that match the dark theme.

### 7. UX Safety Nets

- **Confirm dialogs for destructive actions:** Delete trade and delete account both require an explicit confirm step (modal or inline "are you sure?").
- **Undo via toast:** Pair soft deletes (§3) with a "Trade deleted. Undo?" toast that restores within ~10s.
- **Optimistic UI:** Trade create/edit should feel instant — render the new/updated row immediately, reconcile on server response, roll back with a toast on error.
- **Form library:** Install `react-hook-form` + `@hookform/resolvers/zod` and reuse the existing Zod validators in `src/lib/validators.ts`. Gives you focus-on-error, retained values on validation failure, and proper disabled states during submit.
- **Empty states:** The `EmptyState` primitive already exists — make sure dashboard, trade log, and shared feed all use it with a clear CTA ("Log your first trade").
- **Loading states:** `loading.tsx` files exist; verify they render real skeletons (not blank), and that interactive elements show a spinner/disabled state during async work.

### 8. Code Quality & DX

- **ESLint config:** Extend with `eslint-config-next`, `@typescript-eslint`, and add rules for: no unused vars, no `any`, consistent imports.
- **Prettier config:** Create `.prettierrc` — single quotes, no semicolons (or my preferred style), 100 char line width.
- **Path aliases:** Confirm `@/` alias works for `src/` imports everywhere.
- **Editor config:** Add `.editorconfig` for consistent formatting across editors.
- **Import sorting:** Add `eslint-plugin-import` or `@trivago/prettier-plugin-sort-imports` to auto-sort imports.

### 9. Performance

- **Image optimization:** Use `next/image` for any displayed images. Trade screenshots should be served via Supabase with optimized sizing.
- **Lazy loading:** Lazy-load heavy components (charts, calendar heatmap) with `dynamic()` imports.
- **Database indexes:** Add Prisma indexes on: `Trade.userId`, `Trade.status`, `Trade.entryDate`, `Trade.assetType`, `Tag.userId`.
- **Pagination:** The trade log table must paginate or use infinite scroll — never load all trades at once.
- **Caching:** Use Next.js `revalidate` or SWR/React Query for dashboard stats that don't need real-time updates.
- **Bundle analysis:** Add `@next/bundle-analyzer` as a dev dependency. Add script `npm run analyze`.

### 10. Mobile & Browser

- **Responsive design pass:** Verify every page works at 375px wide (iPhone SE). The `MobileHeader` component already exists — confirm sidebar is hidden on mobile and the table on `/trades` is usable (consider a card layout on narrow screens).
- **Viewport meta tag:** Confirm `<meta name="viewport" content="width=device-width, initial-scale=1">` is in the root layout.
- **Touch target audit:** Buttons, links, and form controls should be ≥44×44px on mobile. Tailwind: `min-h-11 min-w-11` for icon-only buttons.
- **Favicon set:** Add `favicon.ico`, `icon.svg`, `apple-touch-icon.png` (180×180), and reference them via the App Router metadata API.
- **App manifest:** Add `public/manifest.json` with name, short_name, theme_color (matches dark theme), background_color, and icons. Link from root layout.
- **Theme color:** Add `<meta name="theme-color" content="#0a0a0a">` (or whatever the dark-theme bg is) so mobile browser chrome matches.
- **Browser support matrix:** Document supported browsers in the README (last 2 versions of Chrome/Firefox/Safari/Edge; explicitly drop IE).

### 11. Documentation

- **README.md:** Create a proper README with: project description, screenshot/GIF, tech stack, setup instructions (clone, env vars, DB setup, run), available scripts, project structure overview, contributing guidelines.
- **API docs:** Add brief JSDoc comments on every API route / server action describing: what it does, required auth, expected input, response shape.
- **CONTRIBUTING.md:** Short guide — how to set up locally, branch naming convention (`feature/`, `fix/`, `chore/`), PR process.
- **LICENSE:** Add MIT license (or ask me which one I want).

### 12. Git & Repo Hygiene

- **`.gitignore`:** Ensure it covers: `node_modules`, `.next`, `.env*.local`, `.vercel`, `coverage/`, `*.log`, `.DS_Store`, `prisma/*.db`.
- **Commit convention:** Use conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`) — document this in CONTRIBUTING.md.
- **Changelog:** Add a basic CHANGELOG.md structure.

### 13. Dependency Hygiene

- **Dependabot or Renovate:** Add `.github/dependabot.yml` (one file, batched weekly PRs, ecosystem: `npm`). Catches CVEs without manual auditing.
- **`npm audit` in CI:** Add a non-blocking `npm audit --audit-level=high` step to the workflow. Visible but doesn't break builds on transitive low-severity issues.
- **`.nvmrc`:** Pin the Node version (e.g., `20`) so contributors and Vercel agree on the runtime.
- **`engines` field in `package.json`:** `"engines": { "node": ">=20" }`.
- **Lockfile policy:** `package-lock.json` is the source of truth. Document in CONTRIBUTING.md that you don't accept yarn or pnpm lockfiles.
- **Trim unused deps:** Run `npx depcheck` once and remove anything unused. Then add it as a periodic check.

### 14. Accessibility

- **Keyboard navigation:** All interactive elements (buttons, form inputs, modals) must be keyboard-accessible.
- **ARIA labels:** Add appropriate ARIA labels to icon-only buttons, charts, and custom components.
- **Focus management:** When a modal opens, focus should trap inside it. When it closes, focus returns to the trigger.
- **Color contrast:** Verify text contrast ratios meet WCAG AA in the dark theme (4.5:1 for normal text).

### 15. Deployment & Environments

- **Environment separation:** Document how to set up separate Supabase projects for dev and prod.
- **Vercel config:** Add `vercel.json` if needed for redirects or headers.
- **Health check:** Add a `/api/health` route. Should ping Prisma (`SELECT 1`) and Supabase, returning 503 if either is unreachable — not just a static `{ status: "ok" }`.
- **Database migrations:** Document the migration workflow: dev locally with `prisma migrate dev`, apply to prod with `prisma migrate deploy`.
- **Seed script:** Add `prisma/seed.ts` that creates a test user + 20–30 sample trades across asset types. Wire it via the `prisma.seed` field in `package.json`.
- **DB reset script:** Add `npm run db:reset` → `prisma migrate reset --force && prisma db seed`. Saves time during development.
- **Preview environments:** Vercel preview deployments should point at a non-prod Supabase project (or at minimum, a non-prod schema). Don't share auth or data with prod.

### 16. Domain-Specific (Trade Journal)

- **CSV export:** "Export all trades" button in settings — generates a CSV with all fields. Pairs with the data export from §2.
- **CSV import:** Generic CSV import with column mapping (broker exports vary). At minimum, support a documented TradeLog format. Friends will have history before they start using TradeLog.
- **Currency formatting:** Use `Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' })` consistently via a `formatCurrency` helper in `src/lib/utils.ts`. Combine with `decimal.js` (already installed) for math; `Intl` for display.
- **Timezone-aware dates:** Add a `timezone` field on the User model (default to `Intl.DateTimeFormat().resolvedOptions().timeZone` at signup). Use it on the server when rendering dates so SSR matches the user's local time. Either `date-fns-tz` or native `Intl.DateTimeFormat` with the timezone option.
- **P&L precision:** P&L math must go through `decimal.js`, not native JS numbers. `(exitPrice - entryPrice) * quantity - fees` with floats will drift on long-tail crypto prices.
- **Asset symbol normalization:** Decide on a canonical format ("BTC-USD" vs "BTCUSD" vs "BTC/USD") and enforce it via a normalizer before save.

---

## Priority order:

If doing this in stages:

**Phase A — Don't ship without these:**

1. **Security** (§1: auth guards, RLS, input validation, env audit, file upload validation)
2. **Privacy & Legal** (§2: privacy policy, ToS, account deletion, robots.txt) — needed before going beyond OAuth test users
3. **Data Integrity** (§3: soft deletes decision, CHECK constraints, audit trail) — schema decisions are painful to retrofit
4. **Error Handling & Observability** (§6: error boundary, toasts, error pages, Sentry actually wired up)

**Phase B — Should-haves before opening to friends:** 5. **UX Safety Nets** (§7: confirm dialogs, undo, react-hook-form, optimistic UI) 6. **Code Quality** (§8: linting, formatting, pre-commit hooks) 7. **Testing** (§4: unit tests for utils, then component tests, then E2E) 8. **CI/CD** (§5: GitHub Actions) 9. **Mobile & Browser** (§10: responsive pass, viewport, favicons, manifest) 10. **Dependency Hygiene** (§13: Dependabot, .nvmrc, engines)

**Phase C — Polish:** 11. **Documentation** (§11: README, API docs, CONTRIBUTING) 12. **Performance** (§9: indexes, pagination, lazy loading) 13. **Accessibility** (§14: keyboard nav, contrast, ARIA, focus traps) 14. **Deployment** (§15: env separation, health check depth, seed script) 15. **Domain-Specific** (§16: CSV import/export, timezone, currency formatting) 16. **Git & Repo Hygiene** (§12: conventional commits, CHANGELOG)

## Decisions locked in:

1. **Observability:** Sentry for errors + Vercel Analytics for web vitals. PostHog deferred until there's a real question to answer.
2. **Trade deletion:** Soft delete via `deletedAt` column. All list queries filter on it. Pairs with the Undo toast in §7.
3. **Audit trail:** Separate `TradeRevision` table — full history, queryable, surfaced on the trade detail page.
