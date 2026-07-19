# ML prediction (`/predict`)

The Predict page serves an experimental machine-learning forecast: for any
ticker, the probability that its price closes **higher after one day / one
week**. It is the productionized half of the course's מסלול 2 final project
(the research half is the Colab notebook in [`ml/`](../ml/README.md)).

Like the Playground, it is **sandboxed** — predictions live in their own table
and never touch positions, stats, or the equity curve.

## The pipeline at a glance

```
ml/train.py (Python, offline)                    src/lib/ml/ (TypeScript, at request time)
─────────────────────────────                    ─────────────────────────────────────────
Yahoo v8 daily closes, 14 assets,   ──trains──▶  model.d1.json / model.w1.json (tree dumps)
2020 → today                                     meta.json (feature order, intercepts,
19 price-action features                                    metrics, backtest summary)
XGBoost d1 + w1, chronological split
                └──also exports──▶  tests/unit/fixtures/ml-goldens.json
                                    (candles → expected features → expected p)
```

At request time (`runPrediction` server action):

1. `resolveSymbol` — same AssetSymbol row the rest of the app uses.
2. `fetchDailyHistory` (`src/lib/ml/history.ts`) — ~1y of daily closes+volume:
   - **CRYPTO** → CoinGecko `/market_chart?interval=daily` (keyless; coin id from `AssetSymbol.exchange`).
   - **STOCK/FOREX** → Yahoo v8 chart endpoint (keyless) — the _same endpoint training used_.
3. `computeLatestFeatures` (`features.ts`) — the 19-feature vector for the last bar.
4. `predictPUp` (`model.ts` → `xgboost.ts`) — walk the JSON trees, sigmoid(margin + intercept).
5. Persist a `Prediction` row; the page resolves it against a live quote once
   the horizon passes and scores it **HIT/MISS**.

## The parity contract (the part you must not break casually)

Training happens in Python, inference in TypeScript. They agree because both
sides implement the features under the same constraints:

- **Plain loops, no library indicators.** No pandas `ewm`, no ta-lib.
- **Finite lookback (max 50 bars).** Recursive indicators (true EMA, Wilder
  RSI) depend on the entire series length — impossible to reproduce exactly
  when inference fetches a different amount of history than training did. So:
  Cutler's RSI (windowed sums), an SMA-based MACD proxy, rolling population
  std. A feature row depends on exactly the last 50 candles, nothing else.
- **NaN is a first-class value** meaning "missing" (e.g. volume on forex).
  XGBoost routes it through each node's `missing` branch; the TS evaluator
  (`xgboost.ts`) does the same, and casts values to float32 with `Math.fround`
  before threshold comparison because that's what XGBoost's predictor does.
- **The intercept is measured, not assumed** — `train.py` computes
  `output_margin − Σ(leaves)` on real rows, asserts it constant, and stores it
  in `meta.json` (XGBoost's `base_score` JSON semantics changed across
  versions; measuring sidesteps the trivia).

**Enforcement:** `train.py` exports golden vectors from the real trained model;
`tests/unit/ml-features.test.ts` and `ml-xgboost.test.ts` assert the TS
pipeline reproduces the expected features (9 decimals) and probabilities
(8 decimals) from raw candles. Change a formula on one side only and the suite
fails. **The four artifacts regenerate together** — never commit a fresh model
without its goldens (or vice versa).

## The features (v1.0.0)

All scale-free (ratios/returns/z-scores), computable from close+volume only:

| Group          | Features                                                                              |
| -------------- | ------------------------------------------------------------------------------------- |
| Momentum       | `logret_1/2/3/5/10`                                                                   |
| Trend          | `sma_ratio_7_21`, `sma_ratio_21_50`, `close_over_sma50`, `macd_hist_norm` (SMA-proxy) |
| Oscillator     | `rsi_14` (Cutler)                                                                     |
| Volatility     | `vol_7`, `vol_21`, `vol_ratio_7_21`                                                   |
| Range position | `dist_max_20`, `dist_min_20`                                                          |
| Flow           | `volume_z20` (NaN when venue reports no volume)                                       |
| Calendar       | `dow_sin`, `dow_cos` (Monday=0, UTC)                                                  |
| Asset class    | `is_crypto`                                                                           |

Deliberately **no alternative data** in the deployed model: the app must score
any ticker keylessly at request time. The notebook's full model (on-chain +
macro + trends) exists for the research comparison; see
[`ml/README.md`](../ml/README.md).

## Honest numbers (test window 2025-10 → 2026-07)

From `meta.json` (also surfaced in the UI's "About this model"):

- **d1**: AUC ≈ 0.53, accuracy ≈ 51.7% vs 51.8% base rate — barely above coin flip, which is the true state of daily direction forecasting.
- **Backtest** (long when p ≥ 0.55, flat otherwise, 10 bps per position change):
  BTC **+9.7% vs −46.1%** buy & hold (the model sat out most of the crash);
  AAPL −5.8% vs +30.5% (it kept stepping out of a rally). The edge is
  drawdown-avoidance, regime-dependent, and fee-fragile — the UI says so.

## Data conventions (pinned, easy to get wrong)

- A bar whose UTC date is **today** is a session in progress → dropped everywhere.
- CoinGecko's midnight point at `00:00` of day D is the close **of day D−1**;
  its trailing non-midnight point is a "right now" sample → dropped.
- Yahoo `close` is split-adjusted (not dividend-adjusted) — consistent between
  training and serving; recent 1y inference windows rarely span splits anyway.
- Crypto trains on Yahoo `BTC-USD` but serves from CoinGecko — venue closes
  differ by tens of bps (documented domain shift; scale-free features shrink
  the impact, golden tests pin the _code_, not the venue).

## Prediction lifecycle

- One prediction per `(user, symbol, horizon)` per UTC day — reruns return the
  existing row (`deduped: true`) instead of spamming history.
- `resolvesAt` = created + 24h (D1) / +7d (W1) — a calendar approximation of
  the bar-based label; documented in `lifecycle.ts`.
- Resolution is **lazy**: the first `/predict` view past `resolvesAt` fetches a
  cached quote (15-min TTL), fills `resolvedPrice`, scores HIT/MISS
  (exactly-flat = MISS), stamps `resolvedAt`. No cron at this scale.
- The history card shows the user's own track record (hits / scored).

## Retraining

```bash
pip install -r ml/requirements.txt
python ml/train.py          # regenerates artifacts + goldens together
npx vitest run              # parity must stay green
```

Bump `VERSION` in `train.py` when the feature set changes — `modelVersion` is
stamped on every Prediction row, so historical rows stay attributable to the
model that made them.

## Limitations / future work

- One 9-month test window, one regime change — walk-forward evaluation next.
- Threshold 0.55 chosen a priori; probabilities are uncalibrated.
- Stocks/forex inference depends on Yahoo's unofficial-but-stable endpoint;
  failures degrade to the standard "historical data unavailable" message.
- Macro features are keyless too and could join the deployed model in v2.
