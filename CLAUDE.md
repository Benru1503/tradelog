# CLAUDE.md

## Project

TradeLog — a full-stack trading diary/logger for a small group of friends. Log trades across stocks, crypto, and forex. Private by default, with optional sharing.

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

- **Trade:** asset, assetType (STOCK/CRYPTO/FOREX), direction (LONG/SHORT), entryPrice, exitPrice, quantity, fees, status (OPEN/CLOSED), pnl, notes, isShared
- **Tag:** user-scoped labels (e.g., "breakout", "earnings play") with colors
- **TradeImage:** screenshots attached to trades via Supabase Storage

## Current Phase

Phase 1 — MVP: auth, trade CRUD, trade log table, dashboard with stats + equity curve, dark theme.

## Do NOT

- Do not add real-time price feeds or live market data
- Do not implement payment or subscription logic
- Do not use `any` type — always type properly
- Do not store secrets in code — use `.env.local`
- Do not create separate CSS files — Tailwind only
