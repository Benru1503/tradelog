# Deploying TradeLog to Vercel

Written 2026-08-13, deployed 2026-08-18. Signup is **open** — anyone with a
Google account can register. That was a deliberate product decision; see
"Open signup" at the end for what it does and doesn't expose.

---

## 0. The live deployment

**Production: <https://tradelog-peach.vercel.app>**

|                       |                                                       |
| --------------------- | ----------------------------------------------------- |
| Vercel project        | `tradelog`, Ben's personal scope, Hobby plan          |
| Git source            | `Benru1503/tradelog`, branch `main` — push to deploy  |
| Function region       | `fra1` (Frankfurt)                                    |
| Deployment protection | Standard — preview deployments require a Vercel login |
| Cron                  | `/api/health` daily 06:00 UTC, from `vercel.json`     |

**Function region must match the database.** Vercel defaults new projects to
`iad1` (Washington DC) while Supabase sits in Frankfurt, which put a
transatlantic hop on every Prisma query: `/api/health` measured **1222ms** on
`iad1` versus **15ms** on `fra1`, and a page render makes several queries. Set
it under Settings → Functions, then redeploy — a region change only takes
effect on a new deployment.

Note that **Production Branch lives under Settings → Environments → Production**,
not Settings → Git, where older guides imply it sits.

### Only one deployment may point at this database

Any Vercel project holding these environment variables writes to the same
production Postgres. A second deployment on older code is not a spare — it is
an unpatched copy of the app on live data, and security fixes merged to `main`
do not reach it. This happened: a fork-based deployment ran for a day without
the app-level sign-in enforcement added in `fbdfbec`.

If a second deployment is needed, keep it current with `main` or shut it down.

---

## 1. Import the repo

_Done for the current deployment — kept for setting up a new one._

Importing must be done **by the account that owns the repo**. Connecting a repo
requires the Vercel GitHub App installed on the owning account, and a
collaborator cannot install an app on someone else's private repo; their only
route is a fork, which then deploys code that isn't `origin/main`.

1. <https://vercel.com/new> → import `Benru1503/tradelog`.
2. Framework preset: **Next.js** (autodetected). Leave the build command,
   output directory, and install command at their defaults — `postinstall`
   already runs `prisma generate`.
3. **Do not deploy yet.** Set the environment variables first (step 2), or the
   first build will fail on the missing Supabase vars.

## 2. Environment variables

Print the exact block to paste, from the repo root:

```bash
grep -E '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|DIRECT_URL|FINNHUB_API_KEY|COINGECKO_DEMO_API_KEY|GEMINI_API_KEY|GEMINI_MODEL)=' .env
```

Set each for **Production, Preview, and Development**.

### Do NOT set these

| Variable               | Why not                                                                                                                                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` | Used in exactly one place (`login/page.tsx`) and falls back to `window.location.origin`. Leaving it unset makes login work correctly on production, previews, and any custom domain. **Setting it to the localhost value from `.env` will redirect your users to localhost.** |
| `TEST_AUTH_SECRET`     | Only used by `/api/test/*`, which return 404 when `NODE_ENV=production`. Nothing in prod reads it.                                                                                                                                                                            |
| `SENTRY_*`             | Never integrated. Ignore the block in `.env.local.example`.                                                                                                                                                                                                                   |

`SUPABASE_SERVICE_ROLE_KEY` **is** needed in production — the Settings →
delete-account flow uses it. It is set on `tradelog-peach`. A deployment
without it works in every other respect and fails loudly on delete-account.

Two variables are deliberately absent rather than blank: `COINGECKO_DEMO_API_KEY`
(crypto works keyless) and `GEMINI_MODEL` (defaults to `gemini-flash-latest`).
The code reads both through `?.trim() ||`, so blank and absent behave
identically — don't paste empty values in to "be safe".

## 3. Deploy, then wire up OAuth

The first deploy gives you a URL like `https://tradelog-xxxx.vercel.app`.
**Google sign-in will not work until you do both of these** — a failed callback
now lands on `/login` with a readable message rather than a silent bounce:

**Supabase → Authentication → URL Configuration**

- Site URL: `https://<your-domain>`
- Redirect URLs, add both:
  - `https://<your-domain>/auth/callback`
  - `https://<your-domain>/**`
- Keep the existing `http://localhost:3000/**` entries so local dev still works.

**Google Cloud Console → APIs & Services → Credentials → your OAuth client**

- Authorised redirect URIs must include the Supabase callback:
  `https://jxlmdplmpykendthmjpy.supabase.co/auth/v1/callback`
- This is usually already set from the initial setup — check rather than assume.

If login bounces back to `/login?error=auth`, it is almost always one of these
two lists, not the keys.

## 4. Verify

In the browser:

- [ ] Google sign-in completes and lands on `/dashboard`
- [ ] `/trades` renders; create a trade and confirm it persists
- [ ] `/shared` shows shared trades with **display names, never email addresses**
- [ ] `/coach` generates a report (needs ≥ 5 closed trades)
- [ ] `/predict` returns a BTC call
- [ ] Sign out works

From a terminal, no session required — these caught real problems on the first
deploy and are worth re-running after any infrastructure change:

```bash
D=https://tradelog-peach.vercel.app; curl -sS "$D/api/health"; curl -sSI "$D/" | grep -iE 'x-frame|x-content-type|strict-transport|x-vercel-id'; for p in /dashboard /shared /api/test/whoami; do printf '%s %s\n' "$p" "$(curl -sS -o /dev/null -w '%{http_code}' "$D$p")"; done; curl -sS -o /dev/null -w 'POST /api/test/login %{http_code}\n' -X POST "$D/api/test/login"
```

Expected: health `ok` with `latencyMs` in the tens (hundreds means the function
region drifted off `fra1`); `x-frame-options: DENY`, `nosniff`, and an HSTS
header; `/dashboard` and `/shared` both `307`; `/api/test/whoami` and a **POST**
to `/api/test/login` both `404`. A GET on `/api/test/login` returns 405, not
404 — Next rejects the method before the route's production guard runs, which
looks alarming and isn't; POST is the only method that could mint a session.

To prove no server-side secret reached the browser, fetch `/login` plus every
`/_next/static/*.js` it references and grep for the service-role key, the
provider keys, and the database password. The anon key **is** expected there —
it is public by design and RLS is what protects the data.

## 5. Ongoing

**Migrations are not automatic.** The build runs `prisma generate`, not
`prisma migrate deploy`. After merging any migration, run it yourself against
production:

```bash
npx prisma migrate deploy
```

Then re-run `prisma/rls_policies.sql` if the migration added a table — default
privileges are locked down, but RLS still has to be enabled per table.

**The Supabase pause trap** is handled by `vercel.json`, which pings
`/api/health` daily at 06:00 UTC. Free-tier projects pause after ~1 week idle;
a daily ping keeps it awake. If you ever remove that cron, the site will start
dying roughly weekly.

**Preview deploys share the production database.** Every PR preview points at
the same Supabase project, so anything you do in a preview is real data. Treat
previews as production.

## Open signup

Anyone with a Google account can register. What that means concretely:

- **Google is enforced in application code**, not by the Supabase dashboard.
  `src/lib/auth-policy.ts` is checked in middleware and rejects any session
  whose identity is not Google, clearing its `sb-*` cookies. This exists
  because the Supabase Auth API is reachable directly with the public anon key:
  with the Email provider enabled, anyone can `POST /auth/v1/signup` and get a
  valid session without ever loading the login page. **The Email provider is
  currently enabled** — the Playwright suite signs in with a password through
  `/api/test/login` — and that is safe only because this check exists and
  `/api/test/login` is 404 in production. A deployment running older code has
  neither protection.

- **Private trades stay private.** Every query is user-scoped, and RLS is on
  across all tables (`prisma/rls_policies.sql`). A stranger sees only their own
  data plus the shared feed.
- **`/shared` is visible to every registered user** — that is its purpose. It
  shows trades explicitly marked shared, with the author's display name. Emails
  are no longer selected or rendered.
- **`/coach` is capped at 10 generations per user per rolling 24 hours**, because
  every install shares one Gemini key and the `force` path skips the cache.
- **Finnhub is one 60-req/min key shared by all users.** A 15-minute cache
  absorbs most of it, and `src/lib/rate-limit.ts` caps ticker search at 60/min
  and first-trade-date lookups at 30/min per user. That limiter is per-instance
  and best-effort by design — it stops a runaway client, not a distributed one.
  Sustained signup traffic degrading quotes for everyone is still the first
  thing to watch if the app gets popular.
- **`/predict` is capped at 10 runs/minute and 40/day per user.** Reruns of the
  same symbol and horizon dedupe to the existing row and do not count.
