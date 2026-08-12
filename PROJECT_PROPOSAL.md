# TradeLog — Project Proposal

**A private trading journal for serious retail investors.**

_Capstone Project Proposal · Ben Rubinovitz · 2026_

---

## 1. Summary

**TradeLog** is a full-stack web application that lets a small, trusted group of
investors record, analyse, and reflect on their trades across **stocks, crypto,
and forex** — in one place, with privacy by default and optional sharing.

Most retail traders today track their activity in a tangle of brokerage
statements, spreadsheets, and screenshots. That works for _remembering_ what
they did, but not for _learning_ from it. TradeLog turns a scattered trade
history into a structured, queryable journal with real portfolio analytics —
the kind of feedback loop that separates disciplined investors from gamblers.

---

## 2. The Problem

Retail trading has exploded, but the tooling hasn't kept up with how people
actually trade:

- **Brokerages are siloed.** A trader with positions on a stock broker, a crypto
  exchange, and a forex platform has _three_ histories and _zero_ unified view.
- **Spreadsheets don't scale.** Manual logs are error-prone, can't compute
  risk-adjusted returns, and never tell you _why_ a strategy is working.
- **Performance is misleading.** A naïve "account went up 10%" ignores deposits
  and withdrawals. Without **time-weighted** and **money-weighted** returns, you
  can't tell skill from cash flow.
- **There's no honest feedback loop.** Without notes tied to each trade, traders
  repeat the same mistakes — and forget the reasoning behind their wins.

The core pain is simple: **traders can see what they own, but not how well they
trade.**

---

## 3. The Solution

TradeLog is a private trading diary with the analytical depth of a portfolio
tool. Planned capabilities:

| Capability              | What it does                                                                      |
| ----------------------- | --------------------------------------------------------------------------------- |
| **Unified trade log**   | One journal for stocks, crypto, and forex — long or short, open or closed.        |
| **Position tracking**   | Groups individual trade legs into positions, with averaged cost and realised P&L. |
| **Honest performance**  | Time-weighted & money-weighted returns so deposits never masquerade as gains.     |
| **Analytics & charts**  | Equity curve, sector heatmap, allocation breakdown, and top movers.               |
| **Market data**         | Live (delayed) prices and in-trade price charts, fetched securely server-side.    |
| **Watchlist**           | Track symbols you don't own yet, with optional target-price alerts.               |
| **Reflection built in** | Notes, tags, and screenshots attached to every trade — the learning layer.        |
| **Scenario playground** | "What-if" and dollar-cost-averaging simulators to test ideas risk-free.           |
| **Privacy by default**  | Everything private unless you explicitly choose to share a trade with the group.  |

The guiding principle: **P&L and returns are always computed, never hand-typed.**
The journal is a source of truth, not a place to fudge the numbers.

---

## 4. Who It's For

- **Primary:** A close-knit group of active retail traders (5–15 friends) who
  trade across multiple asset classes and want to improve, not just record.
- **Secondary:** Any disciplined individual investor who has outgrown
  spreadsheets and wants real analytics without handing their full financial
  history to a large commercial platform.

It is explicitly **not** a brokerage, a social network, or a get-rich-quick
signal service. There is no trade execution and no payment logic — TradeLog is a
**journal and analysis tool**, and that focus is a feature.

---

## 5. Why It Matters

- **Educational value.** A structured journal with notes and tags converts raw
  trade history into a personal dataset traders can actually learn from.
- **Financial honesty.** Proper return math (TWR/MWR) gives an unflinching
  picture of performance — the single most useful thing a self-directed investor
  can have.
- **Privacy as a stance.** Built for a trusted group, private by default. Users
  share on their own terms rather than broadcasting by default.

---

## 6. Technical Approach _(overview)_

A modern, type-safe full-stack web app, deployed on managed infrastructure:

- **Frontend & framework:** Next.js (App Router) with TypeScript and a dark,
  responsive UI built in Tailwind CSS.
- **Backend:** Server actions and API routes — **no client-side database access**,
  keeping all data logic and secrets on the server.
- **Database:** PostgreSQL, accessed through the Prisma ORM with versioned
  migrations.
- **Authentication:** Google OAuth, so there are no passwords to manage or leak.
- **Market data:** A pluggable provider layer (e.g. Finnhub / CoinGecko) called
  **only from the server**, with caching so the app stays responsive and never
  crashes on stale or missing prices.
- **Visualisation:** Charting libraries for equity curves, allocation views, and
  in-trade price charts.

Key design commitments: **money values stored as precise decimals**, **dates in
UTC and shown in the user's timezone**, and a strict rule that **financial
figures are derived, never manually entered.**

---

## 7. Project Plan _(high-level milestones)_

1. **Foundations** — Authentication, trade CRUD, positions, cash flows, and the
   core data model.
2. **Analytics & visualisation** — Equity curve, sector/allocation charts,
   dividend tracking, and live market data.
3. **Playground** — What-if and dollar-cost-averaging simulators.
4. **Polish & sharing** — Optional trade sharing, watchlist alerts, and UX
   refinement.

Each milestone is independently demonstrable, so progress is visible at every
stage rather than only at the end.

---

## 8. Success Criteria

The project will be considered successful if it can:

- Log and group trades across all three asset classes with **computed** P&L.
- Report **time- and money-weighted returns** that correctly exclude deposits
  and withdrawals.
- Render an accurate equity curve and allocation breakdown from real trade data.
- Fetch and display live market data **without ever exposing API keys to the
  browser**.
- Run entirely on free-tier managed infrastructure, demonstrating a deployable,
  real-world architecture.

---

## 9. Scope & Constraints

**In scope:** journalling, analytics, market-data display, simulation, and
opt-in sharing within a trusted group.

**Out of scope (by design):** trade execution, brokerage integration, payments
or subscriptions, and any form of public social feed. These boundaries keep the
project focused and achievable within a capstone timeframe.

---

_TradeLog is a tool I'd want to use myself — and that, more than anything, is why
I want to build it._
