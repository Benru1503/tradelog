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
npx prisma studio        # browse the DB visually
npx prisma migrate dev   # create + apply a migration
npx prisma generate      # regenerate the Prisma client
```

## Project layout

See [`CLAUDE.md`](CLAUDE.md).
