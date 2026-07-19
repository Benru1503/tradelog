# Portfolio math

Where every number on the dashboard/analytics pages comes from. All accumulation happens in `decimal.js`; values become `number` only at the display/chart boundary.

## Trade P&L — `calcPnL` (`src/lib/utils.ts`)

```
sign       = LONG ? +1 : −1
pnl        = (exitPrice − entryPrice) × quantity × sign − fees
pnlPercent = pnl / (entryPrice × quantity) × 100
```

Returns `null` while the trade is open. Computed server-side on close/edit — never user-entered.

## Headline stats — `computeStats` (`src/lib/stats.ts`)

Over **closed** trades only: win rate, average win, average loss, best/worst trade, and `avgRR = avgWin / |avgLoss|`. Open trades count toward totals but not toward any ratio.

## The equity curve and why cash flows matter

The naive equity curve ("sum of trade P&L over time") breaks the moment deposits exist: a $1k deposit looks identical to a $1k trading gain. [`src/lib/portfolio.ts`](../src/lib/portfolio.ts) models a **timeline of events** — realized trade P&L at `exitDate`, signed cash flows at `occurredAt` (deposits/dividends +, withdrawals/fee-adjusts −). When a flow and a trade share the same instant, the flow is applied **after** the trade, so a same-day deposit can't retroactively dilute that trade's return.

The dashboard chart (`computeDashboardSeries`) emits both series at every event so the tooltip can always show both numbers:

- **Trading P&L** — cumulative realized P&L; cash flows don't move the line.
- **Account value** — running balance including flows; deposit/withdrawal markers are rendered as dots.

## TWR — time-weighted return (`computeTWR`)

Answers: _how good was the trading, ignoring deposit timing?_

Each cash flow closes a sub-period. The sub-period growth factor is `endValue / startValue`; TWR is the product of all factors minus 1. Deposits change the base of the **next** period but are never counted as gains. Returns 0 if the account never had capital.

## MWR — money-weighted return (`computeMWR`)

Answers: _what did I actually earn on the money I put in, given when I put it in?_ (XIRR-style.)

Cash movements are viewed from the investor's pocket: deposits negative, withdrawals positive, and the current account value as a final positive flow. The rate `r` that zeroes the NPV (`Σ amt / (1+r)^(days/365)`) is found by **bisection on (−0.99, 10)**, 100 iterations, 1e-7 tolerance. If the sign pattern can't bracket a root, it returns 0 rather than guessing.

TWR ≈ skill; MWR ≈ personal outcome. Both are shown because they disagree exactly when deposit timing was lucky/unlucky.

## Cash on hand — `computeCashOnHand`

`Σ signed cash flows − cost basis of open positions`. Realized P&L from closed trades has already settled into the flows-implied balance.

## Position math (`src/lib/positions.ts`)

- `avgCost` = weighted average entry across OPEN legs; `previewAveraging` projects the numbers for the averaging-up modal before committing.
- Unrealized P&L = `(marketPrice − avgCost) × totalQty × sign`, where SHORT flips the sign.
- `recomputePosition` re-derives all snapshot fields from legs inside every trade-mutation transaction — snapshots are cache, legs are truth.

## Playground simulators (`src/lib/playground.ts`)

Pure, side-effect-free functions over a candle series (unit-tested in `tests/unit/playground.test.ts`). Sandbox only — results never feed the dashboard or analytics.

### What-if — `simulateWhatIf`

"What if I'd put $X into asset Y on date D?" Buy and sell dates snap to the **nearest candle** (`pickCandleAt`) and execute at that candle's close; no sell date means "value at the latest candle". Returns shares, sale value, P&L, P&L%.

### DCA — `simulateDca`

Equal-dollar contributions on a `WEEKLY`/`MONTHLY` schedule from a start date. Each contribution buys at the close of the nearest candle. Produces:

- the contribution list (time, price, shares),
- a per-candle series of cumulative invested vs. market value (built in lockstep, O(candles + contributions)),
- totals: invested, final value, P&L, P&L%,
- **CAGR via XIRR** — annualized money-weighted rate over the contribution stream + final value (365.25-day years), not the naive `finalValue / invested`. `null` when the range is too short or bisection can't bracket.

The contribution generator is capped at 10,000 dates to defend against pathological ranges.

### Snapshots

`SimSnapshot` persists **params + totals + contributions only** — the per-candle series is dropped on save because it's fully reproducible from the params and would bloat rows.

## Numeric precision notes

- Decimal.js for all sums/averages; float only inside the NPV/bisection loops (fine for reporting-grade rates).
- Both root-finders (MWR, XIRR) are plain bisection: slower than Newton but immune to divergence, and the (−99%, +1000%) bracket covers any sane portfolio.
