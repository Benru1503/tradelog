# TradeLog — Project Specification

## Overview

TradeLog is a full-stack web app for logging and analyzing trades. It replaces spreadsheet-based trade journals with a clean, purpose-built tool that supports multiple asset classes, personal dashboards, and optional sharing between friends.

**Target users:** Small group of friends/traders (5–15 users)
**Trading style:** Primarily swing/position trading (days to weeks), multi-asset (stocks, crypto, forex)
**Visual style:** Dark theme, modern UI — blend of Robinhood's polish with a data-rich feel

---

## Tech Stack

| Layer            | Technology                                     | Why                                                                |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| **Framework**    | Next.js 14+ (App Router)                       | Single codebase for frontend + API, deploys to Vercel in one click |
| **Language**     | TypeScript                                     | Type safety across the full stack                                  |
| **Database**     | PostgreSQL via Supabase                        | Free tier, hosted, built-in auth + storage                         |
| **ORM**          | Prisma                                         | Type-safe DB queries, easy migrations                              |
| **Auth**         | Supabase Auth (Google OAuth)                   | Google login out of the box, session management included           |
| **Charts**       | Recharts + Lightweight Charts (TradingView)    | Recharts for stats, Lightweight Charts for price visualization     |
| **Styling**      | Tailwind CSS                                   | Utility-first, fast iteration, easy dark theme                     |
| **File Storage** | Supabase Storage                               | Trade screenshot uploads, tied to same backend                     |
| **Hosting**      | Vercel (frontend) + Supabase (DB/auth/storage) | Free tiers, zero DevOps                                            |

---

## Data Model

### User

- `id` (UUID, from Supabase Auth)
- `email`
- `displayName`
- `avatarUrl`
- `createdAt`

### Trade

- `id` (UUID)
- `userId` (FK → User)
- `asset` (e.g., "AAPL", "BTC/USDT", "EUR/USD")
- `assetType` (enum: STOCK, CRYPTO, FOREX)
- `direction` (enum: LONG, SHORT)
- `entryPrice` (decimal)
- `exitPrice` (decimal, nullable — null if trade is still open)
- `quantity` (decimal)
- `entryDate` (datetime)
- `exitDate` (datetime, nullable)
- `status` (enum: OPEN, CLOSED)
- `pnl` (decimal, computed on close)
- `pnlPercent` (decimal, computed on close)
- `fees` (decimal, default 0)
- `notes` (text, nullable)
- `isShared` (boolean, default false)
- `createdAt`
- `updatedAt`

### Tag

- `id` (UUID)
- `userId` (FK → User)
- `name` (e.g., "breakout", "earnings play", "scalp")
- `color` (hex string)

### TradeTag (join table)

- `tradeId` (FK → Trade)
- `tagId` (FK → Tag)

### TradeImage

- `id` (UUID)
- `tradeId` (FK → Trade)
- `url` (Supabase Storage URL)
- `caption` (text, nullable)
- `createdAt`

---

## Pages & Navigation

### Main Layout

- Sidebar nav (collapsible on mobile)
- Dark theme by default

### Pages

1. **Dashboard** (`/dashboard`)
   - Summary stats: total P&L, win rate, total trades, average R:R
   - Equity curve chart (cumulative P&L over time)
   - Calendar heatmap of trading days (green/red intensity by daily P&L)
   - Recent trades list (last 5–10)
   - Streaks: current win/loss streak, best streak

2. **Trade Log** (`/trades`)
   - Table view of all trades (sortable, filterable)
   - Filters: asset type, direction, status, date range, tags
   - Quick-add trade button → opens modal/drawer
   - Click a row → trade detail view

3. **Add/Edit Trade** (modal or `/trades/new`)
   - Form: asset, type, direction, entry/exit price, quantity, fees, dates
   - Notes field (rich text or markdown)
   - Tag selector (multi-select, create new inline)
   - Screenshot upload (drag & drop)
   - Toggle: share this trade

4. **Trade Detail** (`/trades/[id]`)
   - Full trade info
   - Attached screenshots
   - Notes
   - Edit / delete actions

5. **Shared Feed** (`/shared`)
   - Feed of trades marked as shared by all users
   - Shows user avatar + name, trade summary, notes
   - Read-only for non-owners

6. **Settings** (`/settings`)
   - Profile (display name, avatar)
   - Default asset type preference
   - Currency display preference

---

## Phase Plan

### Phase 1 — MVP (Core)

- [x] Project setup (Next.js, Supabase, Prisma, Tailwind)
- [ ] Google OAuth login
- [ ] Trade CRUD (create, read, update, delete)
- [ ] Trade log table with sorting & filtering
- [ ] Dashboard with summary stats + equity curve
- [ ] Dark theme

### Phase 2 — Polish

- [ ] Tags system (create, assign, filter by)
- [ ] Calendar heatmap
- [ ] Win rate & streak tracking
- [ ] Screenshot upload per trade

### Phase 3 — Social

- [ ] Share toggle per trade
- [ ] Shared feed page
- [ ] User profiles

### Phase 4 — Nice-to-Haves

- [ ] CSV import (from broker exports)
- [ ] CSV export
- [ ] Advanced analytics (by tag, by asset type, by day of week)
- [ ] Mobile-responsive PWA
- [ ] Notifications (e.g., open trade reminders)

---

## Key Design Decisions

1. **P&L is computed, not entered** — calculated from entry/exit price × quantity - fees
2. **Open trades are first-class** — trades can exist without an exit price; dashboard differentiates open vs closed
3. **Tags are user-scoped** — each user has their own tags
4. **Sharing is opt-in per trade** — private by default, toggle to share
5. **No real-time price feeds** — this is a journal, not a trading platform. Users enter prices manually
6. **Single currency per trade** — no cross-currency conversion (keep it simple for now)
