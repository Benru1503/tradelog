# TODO

Living checklist for the team. Delete items as they land (git history remembers).
Last updated: 2026-07-19.

## Course submission (פרויקט גמר — מסלול 2)

- [ ] **Run the notebook in Colab and save the executed copy.** The repo version
      ships without outputs; the graded copy must show them. Steps:
  1. Open <https://colab.research.google.com/github/Benru1503/tradelog/blob/main/ml/tradelog_prediction.ipynb>
     (same link as the badge in [ml/README.md](ml/README.md)). Sign in with Google.
  2. `Runtime → Run all` (Ctrl+F9). Click **"Run anyway"** on the
     not-authored-by-Google warning. Takes ~8–12 min on the free CPU runtime.
  3. Sanity-check while it runs: §3 plots render, §7 shows the 3-model
     comparison table, §8 shows equity curves + the fee-sensitivity table,
     §10 prints a tiny `max |Δp|` (that's the production-parity proof).
     If the Google Trends cell prints "unavailable" — that's fine by design.
  4. Save the executed copy back: `File → Save a copy in GitHub` →
     repo `Benru1503/tradelog`, path `ml/tradelog_prediction.ipynb`, branch
     `main`, message `chore(ml): executed notebook run`.
     ⚠️ This creates a commit on `main` from the browser — run `git pull`
     locally before the next coding session.
  5. Also `File → Download → Download .ipynb` as a backup copy for the
     course upload.
- [ ] **מסמך אפיון וסיכום (PDF, ≤5 pages):** problem, architecture, models,
      results, Risks & Caveats, future work. Ready source material:
      [docs/ml-prediction.md](docs/ml-prediction.md) + notebook §11 + the
      backtest tables. Owner: Idan/Ben.
- [ ] **Demo video (3–5 min):** suggested script — `/predict` live (BTC next-day
      → result card → model card), history with a resolved HIT/MISS row, then
      the notebook's §8 backtest charts. OBS/Loom, share the link per the
      course instructions.
- [ ] **Survey (5% of the grade, free points):**
      <https://docs.google.com/forms/d/e/1FAIpQLScoi4MJNRKAN__3Jhmul19GCh5RZLVd7PWg43VSGZD9GTyRSA/viewform>
- [ ] Submission form wants: GitHub repo link (public, no secrets ✅), README
      with run instructions ✅, `requirements.txt` ✅ (`ml/requirements.txt`).

## App / infra follow-ups

- [ ] **Apply the updated RLS policies** — `prisma/rls_policies.sql` gained a
      `predictions` policy; run the file in the Supabase SQL editor (it's
      idempotent). While there, note the TODO inside it: positions/cash_flows/
      watch_items/sim_snapshots never had policies (pre-existing gap).
- [ ] **Supabase free-tier keep-alive** — project auto-pauses after ~1 week
      idle. Options: weekly GitHub Action curling `/api/health` on the deployed
      URL, or upgrade the project.
- [ ] **Browser-pass the Playground checklist** — docs/testing.md §Manual,
      items 1–6 (the 2026-07-19 pass covered `/predict` only).
- [ ] **Upgrade Idan's system Node** to ≥ 20.19 (currently 20.13.1;
      `winget install OpenJS.NodeJS.LTS`). Sessions keep working around it with
      a portable Node in the scratchpad.
- [ ] **Next.js 14 → 16 major upgrade** — clears the 5 npm-audit advisories
      that keep the CI audit job red. Breaking changes; isolated session.
- [ ] **`/privacy` page claims Sentry error tracking** that isn't integrated —
      user-facing legal text, needs a human decision (fix the page or add
      Sentry).
- [ ] **Defensive fix in `requireUser()`** — if a Supabase auth user is deleted
      outside the app's Settings flow and re-registers with the same email, the
      stranded `users` row crashes the upsert (unique email, no FK between
      schemas). Rare, but known.

## Predict / ML v2 ideas (not committed work)

- [ ] Walk-forward retraining on a schedule (model is frozen at 2026-07-19).
- [ ] Probability calibration study (reliability curves) before trusting the %.
- [ ] Keyless macro features (SPX/VIX/DXY) at serving time — the notebook shows
      they add a small edge.
- [ ] Alert when the model flips its call on a held position.
