# Testing

## The battery

| Layer            | Command                | What it covers                                                                                                           |
| ---------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Types            | `npm run typecheck`    | `tsc --noEmit` over the whole repo                                                                                       |
| Lint             | `npm run lint`         | ESLint (`eslint-config-next`)                                                                                            |
| Format           | `npm run format:check` | Prettier, whole repo — **CI fails on a single unformatted file**                                                         |
| Unit / component | `npm test`             | Vitest + jsdom + Testing Library. 74 tests across `utils`, `validators`, `portfolio`, `playground`, `stats`, `positions` |
| E2E              | `npm run test:e2e`     | Playwright (Chromium) against a real dev server + real Supabase                                                          |
| Prod build       | `npm run build`        | Next.js production build                                                                                                 |

Pre-commit, husky + lint-staged run Prettier + ESLint on staged files. Run `npx prettier --write .` before pushing anything broader — a partial format pass fails the CI build job.

## Unit tests

- Config: [`vitest.config.mts`](../vitest.config.mts) (jsdom environment, `@` alias, `tests/e2e` excluded).
- Pure-logic suites live in `tests/unit/`. Anything in `src/lib` should be testable without a DB — keep new logic pure and add a suite alongside the existing six.
- `npm run test:coverage` produces text + HTML coverage (v8).

## E2E tests

Playwright drives a real dev server (port **3100**) against your real Supabase project:

- `tests/e2e/global-setup.ts` + `auth.setup.ts` log in a test user through `POST /api/test/login` — an endpoint that only exists outside production and requires `TEST_AUTH_SECRET` from `.env.local`. The session is saved to `tests/e2e/.auth/user.json` and reused (single worker, tests share one account).
- `tests/e2e/smoke.spec.ts` covers the auth gate, dashboard render, trade CRUD round-trip, validation errors, and list sort/filter.
- **Requires a fully configured `.env.local`** (Supabase keys + DB URLs + `TEST_AUTH_SECRET`). Without secrets the suite cannot run — there is no mocked mode.

## CI (GitHub Actions)

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml), on every push/PR to `main`:

- **build job (the real gate):** `npm ci` → lint → typecheck → format check → unit tests → production build (placeholder env vars).
- **audit job (advisory):** `npm audit --audit-level=high` with `continue-on-error: true`. It is currently **red and that's known/pre-existing**: 5 advisories all chained to Next.js 14, fixed only by the `next@16` major upgrade (deferred — see CHANGELOG). It does not block merges; the build job does.

E2E is **not** in CI (needs real Supabase credentials).

## Environment requirements

- **Node ≥ 20.19** (`engines` enforces this; `.nvmrc` pins major 20 and CI resolves its latest). Older 20.x lacks `require(esm)` support and vitest 4 / jsdom's dependency chain hard-crashes with `ERR_REQUIRE_ESM`. This is exactly the "works in CI, fails on my machine" trap — check `node -v` first.
- Line endings are enforced LF by [`.gitattributes`](../.gitattributes). If you cloned **before** that file existed and Prettier suddenly flags ~150 files on Windows, your working tree is CRLF — re-smudge it:

  ```bash
  git rm --cached -r -q . && git reset --hard
  ```

### Windows / OneDrive notes

- npm installs inside a OneDrive-synced folder are flaky (file locks mid-install). If vitest dies with `Cannot find module './rolldown-binding.win32-x64-msvc.node'`, the platform binding got skipped — restore it without touching the lockfile:

  ```powershell
  npm install --no-save "@rolldown/binding-win32-x64-msvc@$(node -p "require('rolldown/package.json').version")"
  ```

- Prefer pausing OneDrive sync during `npm install`, or keep clones outside synced folders entirely.

## Manual smoke checklist (market data + Playground)

Automated tests cannot exercise live providers, so after touching market-data or Playground code, drive this in a browser (crypto is the golden path — works keyless):

1. `/playground` → What-if: BTC, $1,000, a date last year → result card + chart render.
2. `/playground` → DCA tab: BTC, $100 monthly, ~6-month range → chart shows value area + dashed invested line; CAGR shows a plausible annualized rate.
3. Save a snapshot of each kind → both render in the snapshots list; delete works.
4. What-if on a **stock** → graceful "Historical data unavailable" (Finnhub free tier has no candles) — not a crash.
5. `/watchlist` and `/positions` → prices populate (or `—` placeholders, never errors).
6. `/analytics` → sector heatmap + allocation donut render; dividend widget shows values or "No dividend yields cached yet".
