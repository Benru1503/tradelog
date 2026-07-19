# Market data

All market data is fetched **server-side only** — provider API keys live in `process.env` and must never reach the browser. Never import `src/lib/marketdata/*` from a client component; client code gets prices either from server-rendered props or via `/api/tickers/search`.

Data is best-effort by design (free-tier providers, 5–30 min effective cadence). Every consumer must render gracefully when a price is missing or stale: `—` placeholder, never a crash.

## Provider routing

[`src/lib/marketdata/client.ts`](../src/lib/marketdata/client.ts) exposes a single `MarketDataProvider` router:

| Asset type       | Provider  | Notes                                                        |
| ---------------- | --------- | ------------------------------------------------------------ |
| `STOCK`, `FOREX` | Finnhub   | `https://finnhub.io/api/v1`, needs `FINNHUB_API_KEY`         |
| `CRYPTO`         | CoinGecko | `https://api.coingecko.com/api/v3`, works keyless            |
| untyped search   | both      | Fan-out to Finnhub + CoinGecko, merged, capped at 10 results |

The provider-specific lookup key is stashed in `AssetSymbol.exchange` for crypto (CoinGecko coin id, e.g. `bitcoin`) and forex (e.g. `OANDA:EUR_USD`); stocks quote against the bare ticker.

## Caching layers

| Layer            | Where                       | TTL         | Behavior                                                                 |
| ---------------- | --------------------------- | ----------- | ------------------------------------------------------------------------ |
| Resolved symbols | `AssetSymbol` table         | lazy        | Written on first ticker search; shared across users                      |
| Latest quotes    | `AssetPrice` table          | 15 min      | One row per symbol, overwritten on refresh; stale row served on failure  |
| Sector/industry  | `AssetSymbol.sector`        | lazy        | Enriched on first `/analytics` render (`enrichStockSectors`)             |
| Dividend yields  | `AssetSymbol.dividendYield` | 7 days      | Enriched lazily from Finnhub (`enrichStockYields`); null = no projection |
| Candles (OHLC)   | not persisted               | per-request | `getCandles()` fetched at render time; `null` → "chart unavailable" UI   |

## Who consumes it

| Surface                         | Uses                                            |
| ------------------------------- | ----------------------------------------------- |
| Ticker autocomplete (all forms) | `/api/tickers/search` → symbol search           |
| `/watchlist`                    | Quotes + target-price distance                  |
| `/positions`, `/positions/[id]` | Quotes → market value / unrealized P&L          |
| `/trades/[id]`                  | Candles → in-trade price chart                  |
| `/analytics`                    | Sectors (heatmap), yields (dividend projection) |
| `/dashboard`                    | Quotes → top-movers strip                       |
| `/playground`                   | Candles → what-if & DCA simulations             |

## Free-tier limitations (known + accepted)

- **Finnhub free tier does not serve `/stock/candle`** — stock and forex historical charts and Playground simulations degrade to a friendly "Historical data unavailable" message. Crypto is the golden path for charts.
- **CoinGecko keyless** caps daily-candle history at ~365 days — a 5-year DCA on BTC fails at the data-fetch step. A free demo key (`COINGECKO_DEMO_API_KEY`) raises rate limits (~50 calls/min) but not the history cap.
- **Finnhub free tier** allows 60 calls/min — the 7-day yield TTL and 15-min quote TTL exist to stay under it. If `/analytics` shows "No dividend yields cached yet", Finnhub was likely rate-limited; refresh in a minute.

## Configuration

```env
FINNHUB_API_KEY=""          # required for any stock/forex data
COINGECKO_DEMO_API_KEY=""   # optional, crypto works without it
```

> **After changing any `.env*` value, kill and restart `npm run dev`.** Next.js hot-reloads source code but never re-reads env files in a running process — a stale key looks exactly like a broken provider.

Users can also supply their own provider key from Settings if shared free-tier limits bite.

## Adding a provider

Implement the `MarketDataProvider` interface (`searchSymbols`, `getQuote`) in `src/lib/marketdata/providers/`, add candle support if available, and route the relevant asset types to it in `client.ts`. Keep the contract: return empty results / `null` on any failure — never throw into a page render.
