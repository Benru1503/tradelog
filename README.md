# TradeLog

[![CI](https://github.com/Benru1503/tradelog/actions/workflows/ci.yml/badge.svg)](https://github.com/Benru1503/tradelog/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A full-stack trading diary for a small group of friends. Log trades across **stocks, crypto, and forex**, track positions and cash flows, analyze performance with cash-aware equity curves — and stress-test ideas in a simulation playground. Private by default, with an opt-in shared feed.

## Features

- **Trade log** — complete round trips (entry/exit, fees, tags, screenshots, notes) with soft delete + undo and a per-field edit history.
- **Positions** — legs on the same `(asset, direction)` group automatically; average cost, realized + unrealized P&L, averaging-up preview.
- **Cash flows** — deposits, withdrawals, dividends, and fee adjustments feed an Activity ledger, so a deposit never masquerades as a trading gain.
- **Analytics** — TWR/MWR returns, cash-adjusted equity curve, sector heatmap, allocation donut, projected annual dividends.
- **Watchlist** — symbols you don't own yet, with target-price distance tracking.
- **Playground** — what-if backtests and DCA simulations with XIRR-based CAGR. Sandboxed: never touches your real stats.
- **Predict** — an experimental XGBoost direction forecast (next day / next week) for any ticker, with per-user hit/miss tracking and an honest model card. Trained in Python, served by a pure-TypeScript tree evaluator; the research notebook lives in [`ml/`](ml/README.md).
- **Live market data** — Finnhub (stocks/forex) + CoinGecko (crypto), server-side only, cached in Postgres, graceful `—` on failure.
- **Shared feed** — sharing is opt-in per trade; everything else is private.

## Tech stack

| Layer     | Choice                                        |
| --------- | --------------------------------------------- |
| Framework | Next.js 14 (App Router) + TypeScript          |
| Database  | PostgreSQL (Supabase) via Prisma              |
| Auth      | Supabase Auth — Google OAuth                  |
| Styling   | Tailwind CSS (dark theme)                     |
| Charts    | Recharts (stats) + Lightweight Charts (price) |
| Testing   | Vitest + Testing Library, Playwright E2E      |
| Hosting   | Vercel + Supabase                             |

## Quickstart

Prerequisites: **Node ≥ 20.19** (older 20.x breaks on ESM-only dependencies — check `node -v`), npm, a Supabase project. Full checklist: [docs/prerequisites.md](docs/prerequisites.md).

```bash
npm install
cp .env.local.example .env.local     # or copy a teammate's — see docs/running-locally.md
npx prisma migrate deploy            # apply committed migrations (skip if joining the shared DB)
npm run dev                          # http://localhost:3000
```

First time on a new machine? Follow **[docs/running-locally.md](docs/running-locally.md)** step by step. Provisioning a brand-new Supabase + Google OAuth stack from scratch: **[SETUP.md](SETUP.md)** (~20 min).

> Changed anything in `.env*`? Kill and restart `npm run dev` — Next.js never re-reads env files in a running process.

## Documentation

| Doc                                                | What's inside                                                    |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| [docs/prerequisites.md](docs/prerequisites.md)     | What your machine needs before anything else — start here        |
| [docs/running-locally.md](docs/running-locally.md) | Clone → env → dev server, step by step, with troubleshooting     |
| [docs/architecture.md](docs/architecture.md)       | System overview, auth flow, route map, server actions, decisions |
| [docs/data-model.md](docs/data-model.md)           | ER diagram, table semantics, trade/position lifecycles           |
| [docs/market-data.md](docs/market-data.md)         | Provider routing, cache TTLs, free-tier limitations              |
| [docs/portfolio-math.md](docs/portfolio-math.md)   | P&L, TWR/MWR, equity curve, Playground simulator math            |
| [docs/ml-prediction.md](docs/ml-prediction.md)     | The /predict model: pipeline, Python↔TS parity, retraining       |
| [ml/README.md](ml/README.md)                       | ML final project: Colab notebook, trainer, requirements.txt      |
| [docs/testing.md](docs/testing.md)                 | Test battery, E2E setup, CI, platform gotchas                    |
| [SETUP.md](SETUP.md)                               | Full provisioning walkthrough                                    |
| [CONTRIBUTING.md](CONTRIBUTING.md)                 | Branch/commit conventions, PR flow                               |

## Commands

```bash
npm run dev              # dev server (localhost:3000)
npm run build            # production build
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm test                 # Vitest unit + component tests
npm run test:e2e         # Playwright E2E (needs full .env.local)
npm run format           # prettier --write .
npm run format:check     # what CI runs
npm run db:reset         # drop, migrate, and seed the dev DB
npx prisma studio        # visual DB browser
npx prisma migrate dev   # create + apply a new migration
```

After a fresh database, also apply the manual SQL (Supabase SQL editor or psql): `prisma/manual_constraints.sql` (CHECK constraints Prisma can't express) and `prisma/rls_policies.sql` (row-level security).

## Testing & CI

`npm test` runs 109 unit tests (including golden-vector parity checks that pin the TypeScript ML inference to the Python trainer); `npm run test:e2e` runs 11 Playwright specs. CI (GitHub Actions) gates every PR on lint + typecheck + format + tests + build. The separate `npm audit` job is advisory (`continue-on-error`) and currently red pending the Next.js 16 major upgrade — see [docs/testing.md](docs/testing.md) for the full story.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Short version: branch off `main`, conventional commits, CI green, squash-merge.

## License

MIT — see [LICENSE](LICENSE).
