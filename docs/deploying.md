# Deploying TradeLog to Vercel

Written 2026-08-13, for the first production deploy. Signup is **open** — anyone
with a Google account can register. That was a deliberate product decision; see
"Open signup" at the end for what it does and doesn't expose.

---

## 1. Import the repo

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
delete-account flow uses it.

## 3. Deploy, then wire up OAuth

The first deploy gives you a URL like `https://tradelog-xxxx.vercel.app`.
**Google sign-in will not work until you do both of these:**

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

- [ ] `https://<domain>/api/health` returns OK
- [ ] Google sign-in completes and lands on `/dashboard`
- [ ] `/trades` renders; create a trade and confirm it persists
- [ ] `/shared` shows shared trades with **display names, never email addresses**
- [ ] `/coach` generates a report (needs ≥ 5 closed trades)
- [ ] `/predict` returns a BTC call
- [ ] Sign out works

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

- **Private trades stay private.** Every query is user-scoped, and RLS is on
  across all tables (`prisma/rls_policies.sql`). A stranger sees only their own
  data plus the shared feed.
- **`/shared` is visible to every registered user** — that is its purpose. It
  shows trades explicitly marked shared, with the author's display name. Emails
  are no longer selected or rendered.
- **`/coach` is capped at 10 generations per user per rolling 24 hours**, because
  every install shares one Gemini key and the `force` path skips the cache.
- **Finnhub is one 60-req/min key shared by all users.** A 15-minute cache
  absorbs most of it, but heavy signup traffic will degrade quotes for everyone.
  That is the first thing to watch if the app gets popular.
