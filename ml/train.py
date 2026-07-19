"""TradeLog Predict — model trainer.

Trains the two gradient-boosted direction models (next-day and next-week)
that power the in-app /predict page, and exports them as plain-JSON tree
dumps the TypeScript evaluator (`src/lib/ml/xgboost.ts`) can walk without
any Python at runtime.

Parity contract
---------------
Every feature here is intentionally implemented with PLAIN LOOPS and a
FINITE lookback (max 50 bars) so `src/lib/ml/features.ts` can reproduce the
exact same numbers from the exact same candles. No pandas rolling windows,
no recursive indicators (Wilder RSI / true EMA) whose value depends on the
full series length. If you change a formula here, change features.ts to
match and regenerate the golden fixtures — the vitest suite
(`tests/unit/ml-*.test.ts`) fails on any drift.

Outputs (all regenerated together — never commit one without the others):
  src/lib/ml/artifacts/model.d1.json   tree dump, next-day horizon
  src/lib/ml/artifacts/model.w1.json   tree dump, next-week (5 bars) horizon
  src/lib/ml/artifacts/meta.json       feature order, intercepts, metrics, backtest
  tests/unit/fixtures/ml-goldens.json  candles -> expected features/probabilities

Data: Yahoo Finance v8 chart endpoint (keyless JSON) — the exact same
endpoint `src/lib/ml/history.ts` hits for stock inference. Crypto inference
uses CoinGecko daily closes, which track the same UTC-close convention
(documented domain shift, see docs/ml-prediction.md). Bars whose UTC date
is still today are dropped — a session in progress is not a close.

Usage:  python ml/train.py            (from repo root; ~2 min, network needed)
"""

from __future__ import annotations

import json
import math
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import accuracy_score, roc_auc_score

REPO = Path(__file__).resolve().parents[1]
ARTIFACTS_DIR = REPO / "src" / "lib" / "ml" / "artifacts"
FIXTURES_DIR = REPO / "tests" / "unit" / "fixtures"

VERSION = "1.0.0"
DATA_START = "2020-01-01"
VALID_START = "2025-01-01"  # chronological split: train < valid < test
TEST_START = "2025-10-01"

# Yahoo v8 chart symbols. Crypto uses the -USD pairs.
ASSETS: dict[str, tuple[str, bool]] = {
    # name -> (yahoo symbol, is_crypto)
    "BTC": ("BTC-USD", True),
    "ETH": ("ETH-USD", True),
    "AAPL": ("AAPL", False),
    "MSFT": ("MSFT", False),
    "NVDA": ("NVDA", False),
    "GOOGL": ("GOOGL", False),
    "AMZN": ("AMZN", False),
    "META": ("META", False),
    "TSLA": ("TSLA", False),
    "AMD": ("AMD", False),
    "JPM": ("JPM", False),
    "XOM": ("XOM", False),
    "SPY": ("SPY", False),
    "QQQ": ("QQQ", False),
}

FEATURES = [
    "logret_1",
    "logret_2",
    "logret_3",
    "logret_5",
    "logret_10",
    "sma_ratio_7_21",
    "sma_ratio_21_50",
    "close_over_sma50",
    "rsi_14",
    "macd_hist_norm",
    "vol_7",
    "vol_21",
    "vol_ratio_7_21",
    "dist_max_20",
    "dist_min_20",
    "volume_z20",
    "dow_sin",
    "dow_cos",
    "is_crypto",
]

# First index with a full 50-bar SMA window (i-49..i). Mirror of
# WARMUP_BARS in src/lib/ml/features.ts.
WARMUP = 49

HORIZONS = {"d1": 1, "w1": 5}

BACKTEST_THRESHOLD = 0.55
BACKTEST_FEE = 0.001  # 10 bps per position change


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------


def fetch_yahoo(symbol: str) -> pd.DataFrame:
    """Daily closes+volume from Yahoo's v8 chart endpoint (keyless).

    Yahoo's `close` series is split-adjusted (not dividend-adjusted), which
    is what we want for direction modelling. The bar's UTC date is the
    trading date; a bar dated today is a session in progress and is dropped.
    """
    period1 = int(datetime.strptime(DATA_START, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp())
    period2 = int(datetime.now(timezone.utc).timestamp())
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        f"?period1={period1}&period2={period2}&interval=1d"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (tradelog-trainer)"})
    with urllib.request.urlopen(req, timeout=30) as res:
        data = json.loads(res.read().decode("utf-8"))
    result = data["chart"]["result"][0]
    quote = result["indicators"]["quote"][0]
    today = datetime.now(timezone.utc).date()
    rows = []
    for ts, close, volume in zip(result["timestamp"], quote["close"], quote["volume"]):
        if close is None:
            continue
        date = datetime.fromtimestamp(ts, timezone.utc).date()
        if date >= today:
            continue
        rows.append((pd.Timestamp(date), float(close), float(volume) if volume else math.nan))
    df = pd.DataFrame(rows, columns=["Date", "Close", "Volume"])
    return df.sort_values("Date").drop_duplicates(subset="Date").reset_index(drop=True)


# ---------------------------------------------------------------------------
# Features — plain loops, finite lookback. Mirror of src/lib/ml/features.ts.
# ---------------------------------------------------------------------------


def sma(closes: list[float], i: int, n: int) -> float:
    return sum(closes[i - n + 1 : i + 1]) / n


def std_p(vals: list[float]) -> float:
    """Population std (ddof=0)."""
    m = sum(vals) / len(vals)
    return math.sqrt(sum((v - m) ** 2 for v in vals) / len(vals))


def cutler_rsi(closes: list[float], i: int, n: int = 14) -> float:
    gains = 0.0
    losses = 0.0
    for j in range(i - n + 1, i + 1):
        d = closes[j] - closes[j - 1]
        if d > 0:
            gains += d
        else:
            losses -= d
    if gains == 0.0 and losses == 0.0:
        return 50.0
    if losses == 0.0:
        return 100.0
    if gains == 0.0:
        return 0.0
    rs = gains / losses
    return 100.0 - 100.0 / (1.0 + rs)


def compute_feature_row(
    closes: list[float], volumes: list[float], dows: list[int], i: int, is_crypto: bool
) -> list[float]:
    """Feature vector at bar i. NaN marks a missing value (XGBoost-native)."""
    c = closes[i]
    logret = lambda k: math.log(c / closes[i - k])  # noqa: E731

    sma7 = sma(closes, i, 7)
    sma21 = sma(closes, i, 21)
    sma50 = sma(closes, i, 50)

    # SMA-based MACD proxy (finite lookback, unlike true EMA-MACD):
    # m(j) = SMA12(j) - SMA26(j); signal = mean of m over the last 9 bars.
    m_hist = [sma(closes, j, 12) - sma(closes, j, 26) for j in range(i - 8, i + 1)]
    signal = sum(m_hist) / 9.0
    macd_hist_norm = (m_hist[-1] - signal) / c

    rets_21 = [math.log(closes[j] / closes[j - 1]) for j in range(i - 20, i + 1)]
    vol_7 = std_p(rets_21[-7:])
    vol_21 = std_p(rets_21)
    vol_ratio = (vol_7 / vol_21 - 1.0) if vol_21 > 0 else 0.0

    win20 = closes[i - 19 : i + 1]
    dist_max_20 = c / max(win20) - 1.0
    dist_min_20 = c / min(win20) - 1.0

    vwin = volumes[i - 19 : i + 1]
    if any(not math.isfinite(v) or v <= 0 for v in vwin):
        volume_z20 = math.nan
    else:
        vstd = std_p(vwin)
        volume_z20 = (vwin[-1] - sum(vwin) / 20.0) / vstd if vstd > 0 else math.nan

    dow = dows[i]  # Monday = 0 (Python weekday convention)
    dow_sin = math.sin(2.0 * math.pi * dow / 7.0)
    dow_cos = math.cos(2.0 * math.pi * dow / 7.0)

    return [
        logret(1),
        logret(2),
        logret(3),
        logret(5),
        logret(10),
        sma7 / sma21 - 1.0,
        sma21 / sma50 - 1.0,
        c / sma50 - 1.0,
        cutler_rsi(closes, i),
        macd_hist_norm,
        vol_7,
        vol_21,
        vol_ratio,
        dist_max_20,
        dist_min_20,
        volume_z20,
        dow_sin,
        dow_cos,
        1.0 if is_crypto else 0.0,
    ]


def build_asset_frame(name: str, df: pd.DataFrame, is_crypto: bool) -> pd.DataFrame:
    closes = df["Close"].astype(float).tolist()
    volumes = [float(v) if pd.notna(v) else math.nan for v in df["Volume"].tolist()]
    dows = [d.weekday() for d in df["Date"]]
    rows = []
    n = len(closes)
    for i in range(WARMUP, n):
        feats = compute_feature_row(closes, volumes, dows, i, is_crypto)
        row: dict[str, object] = dict(zip(FEATURES, feats))
        row["asset"] = name
        row["date"] = df["Date"].iloc[i]
        row["close"] = closes[i]
        for key, h in HORIZONS.items():
            row[f"y_{key}"] = (1 if closes[i + h] > closes[i] else 0) if i + h < n else np.nan
        rows.append(row)
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# JSON-dump evaluator (reference implementation of src/lib/ml/xgboost.ts)
# ---------------------------------------------------------------------------


def eval_tree(node: dict, x: dict[str, float]) -> float:
    while "leaf" not in node:
        v = x[node["split"]]
        if isinstance(v, float) and math.isnan(v):
            target = node["missing"]
        elif np.float32(v) < np.float32(node["split_condition"]):
            target = node["yes"]
        else:
            target = node["no"]
        node = next(ch for ch in node["children"] if ch["nodeid"] == target)
    return float(node["leaf"])


def eval_margin(trees: list[dict], x: dict[str, float]) -> float:
    return sum(eval_tree(t, x) for t in trees)


def sigmoid(z: float) -> float:
    return 1.0 / (1.0 + math.exp(-z))


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------


def train_horizon(panel: pd.DataFrame, key: str) -> tuple[list[dict], float, dict]:
    label = f"y_{key}"
    usable = panel.dropna(subset=[label])
    train = usable[usable["date"] < VALID_START]
    valid = usable[(usable["date"] >= VALID_START) & (usable["date"] < TEST_START)]
    test = usable[usable["date"] >= TEST_START]

    X_tr, y_tr = train[FEATURES].to_numpy(dtype=np.float64), train[label].astype(int)
    X_va, y_va = valid[FEATURES].to_numpy(dtype=np.float64), valid[label].astype(int)
    X_te, y_te = test[FEATURES].to_numpy(dtype=np.float64), test[label].astype(int)

    clf = xgb.XGBClassifier(
        n_estimators=600,
        learning_rate=0.05,
        max_depth=3,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=20,
        reg_lambda=1.0,
        objective="binary:logistic",
        tree_method="hist",
        eval_metric="auc",
        early_stopping_rounds=50,
        random_state=42,
        n_jobs=4,
    )
    clf.fit(X_tr, y_tr, eval_set=[(X_va, y_va)], verbose=False)
    booster = clf.get_booster()
    booster.feature_names = FEATURES

    best_n = clf.best_iteration + 1
    trees = [json.loads(s) for s in booster.get_dump(dump_format="json")][:best_n]

    # Derive the additive intercept empirically: XGBoost's margin includes a
    # base_score term whose JSON representation changed across versions, so we
    # measure it instead of trusting any one field. It must be constant.
    dm = xgb.DMatrix(X_te[:200], feature_names=FEATURES)
    margins_model = booster.predict(dm, output_margin=True, iteration_range=(0, best_n))
    rows_as_dicts = [dict(zip(FEATURES, r)) for r in X_te[:200]]
    margins_sum = np.array([eval_margin(trees, r) for r in rows_as_dicts])
    diffs = margins_model - margins_sum
    intercept = float(np.mean(diffs))
    spread = float(np.max(np.abs(diffs - intercept)))
    if spread > 1e-3:
        raise RuntimeError(f"{key}: intercept not constant (spread {spread})")

    # Full-circle check: reference evaluator + intercept == model probabilities.
    proba_model = clf.predict_proba(X_te[:200])[:, 1]
    proba_ours = np.array([sigmoid(m + intercept) for m in margins_sum])
    err = float(np.max(np.abs(proba_model - proba_ours)))
    if err > 1e-4:
        raise RuntimeError(f"{key}: evaluator mismatch (max err {err})")

    p_te = clf.predict_proba(X_te)[:, 1]
    p_va = clf.predict_proba(X_va)[:, 1]
    metrics = {
        "trees": best_n,
        "validAuc": round(float(roc_auc_score(y_va, p_va)), 4),
        "testAuc": round(float(roc_auc_score(y_te, p_te)), 4),
        "testAccuracy": round(float(accuracy_score(y_te, (p_te > 0.5).astype(int))), 4),
        "testBaseRate": round(float(y_te.mean()), 4),
        "testRows": int(len(y_te)),
        "trainRows": int(len(y_tr)),
    }
    print(f"[{key}] {metrics}")
    return trees, intercept, metrics


# ---------------------------------------------------------------------------
# Backtest (quick version for the in-app model card; the Colab notebook
# carries the full analysis)
# ---------------------------------------------------------------------------


def backtest_d1(
    panel: pd.DataFrame, trees: list[dict], intercept: float, asset: str, is_crypto: bool
) -> dict:
    sub = panel[(panel["asset"] == asset) & (panel["date"] >= TEST_START)].sort_values("date")
    sub = sub.dropna(subset=["y_d1"])
    if len(sub) < 30:
        return {}
    closes = sub["close"].to_numpy()
    probs = np.array(
        [sigmoid(eval_margin(trees, dict(zip(FEATURES, r))) + intercept) for r in sub[FEATURES].to_numpy()]
    )
    rets = closes[1:] / closes[:-1] - 1.0  # bar i signal -> bar i+1 return
    in_pos = probs[:-1] >= BACKTEST_THRESHOLD

    equity = 1.0
    bh = closes[-1] / closes[0] - 1.0
    prev = False
    trades = 0
    hits = 0
    daily = []
    for i, take in enumerate(in_pos):
        r = rets[i] if take else 0.0
        fee = BACKTEST_FEE if take != prev else 0.0
        equity *= (1.0 + r) * (1.0 - fee)
        daily.append(r - fee)
        if take:
            hits += 1 if rets[i] > 0 else 0
            if not prev:
                trades += 1
        prev = take
    n_long = int(in_pos.sum())
    curve = np.cumprod([1.0 + d for d in daily])
    peak = np.maximum.accumulate(curve)
    max_dd = float(((curve - peak) / peak).min()) if len(curve) else 0.0
    ann = math.sqrt(365 if is_crypto else 252)
    sharpe = float(np.mean(daily) / np.std(daily) * ann) if np.std(daily) > 0 else 0.0
    return {
        "asset": asset,
        "horizon": "d1",
        "windowFrom": str(sub["date"].iloc[0].date()),
        "windowTo": str(sub["date"].iloc[-1].date()),
        "strategyRetPct": round((equity - 1.0) * 100, 2),
        "buyHoldRetPct": round(bh * 100, 2),
        "hitRatePct": round(hits / n_long * 100, 2) if n_long else None,
        "daysInMarketPct": round(n_long / len(in_pos) * 100, 2),
        "trades": trades,
        "maxDrawdownPct": round(max_dd * 100, 2),
        "sharpe": round(sharpe, 2),
    }


# ---------------------------------------------------------------------------
# Goldens — fixture consumed by tests/unit/ml-features.test.ts & ml-xgboost.test.ts
# ---------------------------------------------------------------------------


def golden_case(
    name: str,
    df: pd.DataFrame,
    is_crypto: bool,
    models: dict[str, tuple[list[dict], float]],
    bars: int = 80,
) -> dict:
    tail = df.tail(bars).reset_index(drop=True)
    closes = tail["Close"].astype(float).tolist()
    volumes = [float(v) if pd.notna(v) else math.nan for v in tail["Volume"].tolist()]
    dows = [d.weekday() for d in tail["Date"]]
    i = len(closes) - 1
    feats = compute_feature_row(closes, volumes, dows, i, is_crypto)
    x = dict(zip(FEATURES, feats))
    expected: dict[str, object] = {
        "features": [None if math.isnan(v) else v for v in feats],
    }
    for key, (trees, intercept) in models.items():
        margin = eval_margin(trees, x)
        expected[key] = {"margin": margin, "pUp": sigmoid(margin + intercept)}
    return {
        "name": name,
        "isCrypto": is_crypto,
        "dates": [d.strftime("%Y-%m-%d") for d in tail["Date"]],
        "closes": closes,
        "volumes": [None if math.isnan(v) else v for v in volumes],
        "expected": expected,
    }


# ---------------------------------------------------------------------------


def main() -> None:
    print(f"tradelog trainer v{VERSION} — xgboost {xgb.__version__}")
    frames = {}
    raw = {}
    for name, (sym, is_crypto) in ASSETS.items():
        df = fetch_yahoo(sym)
        raw[name] = df
        frames[name] = build_asset_frame(name, df, is_crypto)
        print(f"  {name:<6} {len(df):>5} bars  {df['Date'].iloc[0].date()} → {df['Date'].iloc[-1].date()}")

    panel = pd.concat(frames.values(), ignore_index=True)
    print(f"panel: {len(panel)} rows, {len(FEATURES)} features")

    models: dict[str, tuple[list[dict], float]] = {}
    metrics: dict[str, dict] = {}
    for key in HORIZONS:
        trees, intercept, m = train_horizon(panel, key)
        models[key] = (trees, intercept)
        metrics[key] = m

    backtests = []
    for asset in ("BTC", "AAPL", "SPY"):
        bt = backtest_d1(panel, models["d1"][0], models["d1"][1], asset, ASSETS[asset][1])
        if bt:
            backtests.append(bt)
            print(f"  backtest {bt}")

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

    for key, (trees, _) in models.items():
        (ARTIFACTS_DIR / f"model.{key}.json").write_text(
            json.dumps({"trees": trees}, separators=(",", ":")) + "\n"
        )

    meta = {
        "version": VERSION,
        "trainedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "yahoo v8 chart daily closes (keyless)",
        "featureNames": FEATURES,
        "warmupBars": WARMUP,
        "horizons": {
            key: {"bars": HORIZONS[key], "intercept": models[key][1], **metrics[key]}
            for key in HORIZONS
        },
        "dataInfo": {
            "assets": list(ASSETS.keys()),
            "from": DATA_START,
            "validFrom": VALID_START,
            "testFrom": TEST_START,
        },
        "backtest": {
            "threshold": BACKTEST_THRESHOLD,
            "feeBps": int(BACKTEST_FEE * 10000),
            "perAsset": backtests,
        },
    }
    (ARTIFACTS_DIR / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")

    goldens = {
        "featureNames": FEATURES,
        "cases": [
            golden_case("BTC", raw["BTC"], True, models),
            golden_case("AAPL", raw["AAPL"], False, models),
            golden_case("SPY-60bars", raw["SPY"].tail(60), False, models, bars=60),
        ],
    }
    (FIXTURES_DIR / "ml-goldens.json").write_text(json.dumps(goldens, indent=2) + "\n")

    sizes = {p.name: f"{p.stat().st_size / 1024:.0f}KB" for p in ARTIFACTS_DIR.glob("*.json")}
    print(f"artifacts written: {sizes}")
    print("done.")


if __name__ == "__main__":
    sys.exit(main())
