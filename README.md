# TradeLog

A full-stack trading diary for stocks, crypto, and forex. Private by default with an opt-in shared feed.

See [`files/PROJECT_SPEC.md`](files/PROJECT_SPEC.md) for the full spec and [`CLAUDE.md`](CLAUDE.md) for conventions.

## Stack

Next.js 14 (App Router) · TypeScript · PostgreSQL (Supabase) · Prisma · Supabase Auth (Google OAuth) · Tailwind CSS · Recharts · Lightweight Charts

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Provision Supabase

Follow the full step-by-step in [`SETUP.md`](SETUP.md) — covers creating the project, getting connection strings, configuring Google OAuth in Google Cloud, wiring it into Supabase, RLS policies, and deploying to Vercel.

### 3. Configure env

```bash
cp .env.local.example .env.local
# fill in the values from step 2
```

### 4. Run migrations

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 5. Start dev server

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000).

## Useful commands

```bash
npm run dev              # dev server
npm run build            # production build
npm run lint             # ESLint
npm run typecheck        # TypeScript no-emit check
npm run test             # vitest unit + component tests
npm run test:watch       # vitest in watch mode
npm run test:coverage    # vitest with coverage report
npm run test:e2e         # Playwright E2E
npm run format           # Prettier write
npm run format:check     # Prettier check (CI)
npm run db:reset         # drop, migrate, and seed the dev DB
npx prisma studio        # browse the DB visually
npx prisma migrate dev   # create + apply a migration
npx prisma generate      # regenerate the Prisma client
```

After running migrations, also apply the manual SQL files:

```bash
# In Supabase SQL editor (or psql), run:
prisma/manual_constraints.sql   # CHECK constraints (Prisma can't express these)
prisma/rls_policies.sql         # Row-level security policies
```

## Project layout

See [`CLAUDE.md`](CLAUDE.md).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Short version: branch off `main`, conventional commit messages, lint + tests pass, open a PR.

## License

MIT — see [`LICENSE`](LICENSE).
