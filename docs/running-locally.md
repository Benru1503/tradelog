# Running TradeLog locally — step by step

The path from a fresh clone to a working app. Assumes the team's Supabase project already exists; if you're provisioning your own from scratch, do [SETUP.md](../SETUP.md) first and come back at step 4.

## 1. Check prerequisites

Work through **[prerequisites.md](prerequisites.md)**. The one that bites hardest: `node -v` must print **v20.19 or newer**.

## 2. Clone and install

```bash
git clone https://github.com/Benru1503/tradelog.git
cd tradelog
npm install        # postinstall also runs `prisma generate`
```

Windows/OneDrive users: pause sync during the install (see prerequisites).

## 3. Get your environment file

Copy `.env.local` from a teammate into the repo root (it's gitignored — never commit it). Sanity-check it has all of these keys:

```
NEXT_PUBLIC_SUPABASE_URL      NEXT_PUBLIC_SUPABASE_ANON_KEY   SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL                  DIRECT_URL                      NEXT_PUBLIC_SITE_URL
TEST_AUTH_SECRET              FINNHUB_API_KEY
```

No teammate to copy from? `cp .env.local.example .env.local` and fill it via [SETUP.md](../SETUP.md).

## 4. Database

Joining the shared Supabase project: **nothing to do** — migrations are already applied.

Fresh database only:

```bash
npx prisma migrate deploy
```

…then run `prisma/manual_constraints.sql` and `prisma/rls_policies.sql` in the Supabase SQL editor.

## 5. Start the dev server

```bash
npm run dev
```

Open <http://localhost:3000> → you're redirected to `/login` → **Continue with Google**.

> Your Google account must be on the OAuth client's **test users** list (Google Cloud → OAuth consent screen). If you see "app has not completed the verification process", ask whoever owns the Google Cloud project to add your Gmail.

## 6. Verify the round trip

1. `/dashboard` renders with stats cards (empty state is fine).
2. Create a trade at `/trades/new` → detail page renders.
3. `/watchlist` → add BTC → a live price appears within seconds (crypto works keyless).
4. Stock prices showing `—`? Either `FINNHUB_API_KEY` is missing or you changed env without restarting — see the golden rule below.

## 7. Run the checks (before you push anything)

```bash
npm test               # unit tests
npm run typecheck
npm run lint
npx prettier --write . # CI checks the whole repo, not just your diff
```

Optional full E2E (drives a real browser against your dev environment, port 3100):

```bash
npx playwright install chromium   # once
npm run test:e2e
```

## Golden rule of env vars

**`npm run dev` reads `.env*` files once, at startup.** Changed a key, a URL, anything? Kill the server and start it again. Hot reload will never pick it up, and the failure mode is confusing (client and server silently disagree).

## Troubleshooting

| Symptom                                                       | Cause → fix                                                                                        |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `ERR_REQUIRE_ESM` when running tests                          | Node older than 20.19 → upgrade ([prerequisites](prerequisites.md))                                |
| `Cannot find module './rolldown-binding.win32-x64-msvc.node'` | npm skipped the platform binding → recipe in [testing.md](testing.md#windows--onedrive-notes)      |
| Prettier flags ~150 files you never touched (Windows)         | CRLF working tree from a pre-`.gitattributes` clone → re-smudge recipe in [testing.md](testing.md) |
| Login hangs / redirect loop                                   | Env changed while dev server was running → restart it; also check the Supabase redirect allow-list |
| "Access blocked … verification process" on Google login       | Your Gmail isn't a test user on the OAuth consent screen                                           |
| `requireUser()` throws after successful login                 | `DATABASE_URL` / `DIRECT_URL` wrong or unreachable → check with `npx prisma studio`                |
| Stock/forex prices all `—`                                    | `FINNHUB_API_KEY` missing/invalid (or rate-limited — free tier is 60 calls/min)                    |
| Historical chart says "unavailable" for stocks                | Expected — Finnhub free tier has no `/stock/candle`. Crypto charts are the golden path             |
