# TradeLog ML — direction prediction (מסלול 2)

The machine-learning half of TradeLog's **Predict** feature: a next-day / next-week
price-direction model for stocks and crypto, built as the course's Path 2 final
project ("למידת מכונה — מודל לחיזוי מחירי מניות או ביטקוין") and shipped inside
the app at `/predict`.

## What's in this folder

| File                                                       | Role                                                                                                                                                                                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`tradelog_prediction.ipynb`](./tradelog_prediction.ipynb) | **The course deliverable.** Full Colab notebook: data collection (6.5y, 14 assets), alternative-data merge (on-chain + macro + optional Google Trends), EDA, XGBoost vs LSTM, fee-aware backtest, inference demo, production export. |
| [`train.py`](./train.py)                                   | Canonical trainer for the **deployed** model. Fetches data, trains the two XGBoost horizons (d1/w1), exports JSON artifacts + golden test vectors.                                                                                   |
| [`requirements.txt`](./requirements.txt)                   | Python dependencies (per the submission guidelines).                                                                                                                                                                                 |

## Run the notebook

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/Benru1503/tradelog/blob/main/ml/tradelog_prediction.ipynb)

Open in Colab → **Runtime → Run all**. ~8–12 min on the free CPU runtime.
Everything is keyless (Yahoo v8 chart, blockchain.info, CoinGecko) — **no API
secrets anywhere**, as the submission rules require. The Google Trends cell is
optional and skips itself politely when Google rate-limits anonymous clients.

## Retrain the deployed model

```bash
pip install -r ml/requirements.txt   # numpy/pandas/sklearn/xgboost are enough
python ml/train.py                    # ~2 min, network needed
```

This regenerates, **always together** (never commit one without the others):

```
src/lib/ml/artifacts/model.d1.json    next-day tree dump
src/lib/ml/artifacts/model.w1.json    next-week tree dump
src/lib/ml/artifacts/meta.json        feature order, intercepts, metrics, backtest
tests/unit/fixtures/ml-goldens.json   candles → expected features/probabilities
```

Then run `npx vitest run` — the golden-parity suites (`tests/unit/ml-*.test.ts`)
prove the TypeScript inference (`src/lib/ml/`) reproduces the Python pipeline
bit-for-bit. If you changed a feature formula, change **both** sides
(`ml/train.py` **and** `src/lib/ml/features.ts`) or the suite fails — that's the
point.

## How it maps to the course requirements

| Requirement (PDF)                                                            | Where                                                                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| ≥ 3 years of historical data                                                 | Notebook §1 / `train.py` — daily closes since 2020-01-01                                         |
| Merge with alternative data (Trends / On-Chain / macro)                      | Notebook §2 — blockchain.info on-chain series, S&P 500 / VIX / DXY macro, optional Google Trends |
| ≥ 2 models compared (e.g. XGBoost vs LSTM)                                   | Notebook §5–§7 — XGB-lite, XGB-full, LSTM                                                        |
| Detailed Colab notebook (EDA, training, inference)                           | Notebook §3 / §5–§6 / §9                                                                         |
| Financial metrics, not just statistical — backtest with fees, alpha question | Notebook §8 — long/flat strategy, 10 bps fees, fee-sensitivity table, honest conclusion          |
| README + requirements.txt, no secrets in the repo                            | This file, `requirements.txt`, keyless data sources                                              |

## Architecture in one paragraph

The notebook is the research surface; `train.py` is the productionizer. The
deployed model is intentionally the **lite** variant (19 price-action features,
finite 50-bar lookback, no alternative data) because the app must score _any_
ticker keylessly at request time. It ships as a plain-JSON tree dump that an
~80-line TypeScript evaluator walks server-side (float32 split semantics,
NaN → missing branch, measured intercept) — no Python in production, and
train/serve skew is pinned to zero by the golden vectors. Full write-up:
[`docs/ml-prediction.md`](../docs/ml-prediction.md).
