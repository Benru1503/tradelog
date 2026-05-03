# Contributing to TradeLog

Small, friend-scale project. The bar is "leave it better than you found it."

## Local setup

See [`SETUP.md`](SETUP.md) for the full Supabase + Google OAuth walkthrough. TL;DR:

```bash
nvm use                        # pick up Node version from .nvmrc
npm install
cp .env.local.example .env.local
# fill in Supabase + Sentry env vars
npx prisma migrate dev
npm run dev
```

## Branch + commit conventions

- Branch off `main`. Naming: `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`, `docs/<short-name>`.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat: add CSV export action`
  - `fix: prevent NaN P&L on zero-cost basis`
  - `chore: bump prisma to 5.23`
  - `docs: clarify RLS policy intent`
  - `test: cover SHORT P&L edge case`
- Keep commits small and focused. If the diff doesn't fit in one sentence, it's two commits.

## Pre-commit hooks

`husky` + `lint-staged` run Prettier and ESLint on staged files automatically. If a hook fails, fix the issue and re-stage — don't bypass with `--no-verify`.

## Testing

- **Unit + component:** `npm test` (Vitest). Add tests for any new utility or pure logic.
- **E2E:** `npm run test:e2e` (Playwright). Add a flow test for any user-facing change that's hard to cover with unit tests.
- **CI** runs lint, typecheck, format check, unit tests, and build on every PR.

## Pull requests

- Title in conventional-commit form: `feat: short description`.
- Include a brief "what + why" in the body.
- For UI changes, attach a screenshot or screen recording.
- Squash-merge to `main` once CI is green.

## What not to commit

- `.env*` (use `.env.local.example` to document new vars).
- Generated files: `.next/`, `node_modules/`, `coverage/`, `playwright-report/`, `test-results/`.
- Personal trade data.
- Lockfiles other than `package-lock.json` (this project uses npm).

## Schema changes

- Edit `prisma/schema.prisma`, then run `npx prisma migrate dev --name <descriptive-name>`.
- If you need a CHECK constraint or other DDL Prisma can't express, add it to `prisma/manual_constraints.sql` and document it in the PR.
- If you change `auth.uid()`-related access, also update `prisma/rls_policies.sql`.
- Production migrations: `npx prisma migrate deploy`. **Never** run `prisma db push` against production.
