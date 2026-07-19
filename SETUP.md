# TradeLog — Supabase setup guide

End-to-end walkthrough to get TradeLog running locally against a real Supabase project. Total time: ~20 minutes the first time, mostly spent in the Google Cloud console.

You'll need:

- A [Supabase](https://supabase.com) account (free tier is fine)
- A [Google Cloud](https://console.cloud.google.com) account (free)
- Node **≥ 20.19** (older 20.x breaks the test tooling — check `node -v`)
- This repo cloned locally with `npm install` already run

---

## 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> and click **New project**.
2. Pick an organization (create one if needed).
3. Fill in:
   - **Name:** `tradelog` (anything you want)
   - **Database password:** generate a strong one and **save it somewhere** — you can't view it again, only reset it. You'll need it for the `DATABASE_URL` and `DIRECT_URL` env vars.
   - **Region:** pick the one closest to you.
   - **Pricing plan:** Free
4. Click **Create new project** and wait ~2 minutes for it to provision.

Once it's ready, you land on the project dashboard. Note the **project ref** — it's the random string in the URL: `https://supabase.com/dashboard/project/<PROJECT-REF>`. You'll see it in a few connection strings.

---

## 2. Grab the API keys

**Settings → API**

Copy these three values:

| Field in dashboard                                     | Goes into `.env.local` as       |
| ------------------------------------------------------ | ------------------------------- |
| **Project URL** (e.g., `https://abcd1234.supabase.co`) | `NEXT_PUBLIC_SUPABASE_URL`      |
| **Project API Keys → `anon` `public`**                 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **Project API Keys → `service_role` `secret`**         | `SUPABASE_SERVICE_ROLE_KEY`     |

> The `service_role` key bypasses Row Level Security. **Never expose it to the browser.** It's only read in server code.

---

## 3. Grab the database connection strings

**Settings → Database → Connection string**

There are two strings you need: a **pooled** one for app runtime queries, and a **direct** one for Prisma migrations.

1. Find the **Connection pooling** section. Click the **URI** tab.
   - You'll see something like `postgresql://postgres.<REF>:[YOUR-PASSWORD]@aws-0-<REGION>.pooler.supabase.com:6543/postgres`
   - Replace `[YOUR-PASSWORD]` with the password from step 1.
   - Make sure `pgbouncer=true&connection_limit=1` is appended (Prisma needs this for serverless). Your final string should look like:
     ```
     postgresql://postgres.abcd1234:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
     ```
   - **This goes into `DATABASE_URL`.**

2. Scroll up to the **Direct connection** section (also under Connection string). Click **URI**.
   - Same format but port `5432` and no pooler:
     ```
     postgresql://postgres.abcd1234:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres
     ```
   - **This goes into `DIRECT_URL`.**

> Why two? The pooled connection (PgBouncer, port 6543) is what your deployed app will use because it handles bursts of short-lived connections cheaply. But Prisma's migration engine needs a direct connection (port 5432) because it runs DDL statements that PgBouncer doesn't support in transaction mode.

---

## 4. Set up Google OAuth in Google Cloud

This is the longest step. You're creating an OAuth client in Google so users can sign in with their Google accounts.

### 4a. Create / pick a Google Cloud project

1. Open <https://console.cloud.google.com>.
2. Top bar → project picker → **New Project**. Name it `tradelog` (or reuse an existing one). Click **Create**.
3. Make sure that project is selected in the top bar.

### 4b. Configure the OAuth consent screen

You only have to do this once per Google Cloud project.

1. Left nav → **APIs & Services → OAuth consent screen**.
2. Pick **External** → **Create**.
3. Fill in:
   - **App name:** `TradeLog`
   - **User support email:** your email
   - **Developer contact email:** your email
   - Skip everything else (logo, app domain, etc.) for now.
4. **Save and continue** through the next screens (Scopes, Test users) without changing anything.
5. On the Test users screen, click **+ Add users** and add the Google addresses of yourself + the friends who'll use TradeLog. While the app is in "Testing" mode, only listed test users can sign in.
6. Save and continue → Back to dashboard.

> You can leave the app in "Testing" mode indefinitely for a small group. If you ever want it open to anyone with a Google account, you'd click **Publish app** later — but for 5–15 friends, "Testing" is correct.

### 4c. Create the OAuth client ID

1. Left nav → **APIs & Services → Credentials**.
2. **+ Create credentials → OAuth client ID**.
3. **Application type:** Web application.
4. **Name:** `TradeLog web` (anything).
5. **Authorized JavaScript origins** — add both:
   - `http://localhost:3000`
   - `https://YOUR-PROJECT-REF.supabase.co` _(replace with your actual ref)_
6. **Authorized redirect URIs** — add:
   - `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
   - You can copy the exact URL from Supabase → **Authentication → Providers → Google** (it shows the callback URL there).
7. Click **Create**.
8. A modal pops up with **Client ID** and **Client secret**. Copy both — you'll paste them into Supabase next.

---

## 5. Wire Google into Supabase Auth

Back in the Supabase dashboard:

1. **Authentication → Providers**.
2. Find **Google** in the list, click to expand.
3. Toggle it **on**.
4. Paste the **Client ID** and **Client secret** from step 4c.
5. Make sure the **Callback URL (for OAuth)** shown matches what you registered in Google. It will be `https://YOUR-REF.supabase.co/auth/v1/callback`.
6. Click **Save**.

Then configure the redirect allow list:

1. **Authentication → URL Configuration**.
2. **Site URL:** `http://localhost:3000` (you'll change this to your Vercel URL after deploying).
3. **Redirect URLs (allow list):** add both
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/**` (covers everything else during dev)
4. **Save**.

---

## 6. Configure `.env.local`

In the repo root:

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL="https://YOUR-REF.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGc..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGc..."

DATABASE_URL="postgresql://postgres.YOUR-REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.YOUR-REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"

NEXT_PUBLIC_SITE_URL="http://localhost:3000"

# E2E tests — any random string; powers /api/test/login outside production
TEST_AUTH_SECRET="some-long-random-string"

# Market data (see docs/market-data.md) — crypto works keyless via CoinGecko
FINNHUB_API_KEY="your-finnhub-key"
COINGECKO_DEMO_API_KEY=""
```

> If your Postgres password contains special characters (`@`, `:`, `/`, etc.), URL-encode them. e.g. `@` becomes `%40`.

---

## 7. Run the Prisma migration

This creates all the tables (trades, positions, cash flows, watchlist, tags, market-data cache, playground snapshots, …) in your Supabase database.

```bash
npx prisma migrate deploy
```

Expected output ends with `All migrations have been successfully applied.` Use `npx prisma migrate dev --name <descriptive-name>` only when authoring a **new** migration.

If something goes wrong:

- **`P1001: Can't reach database server`** — your `DIRECT_URL` is wrong, or the password isn't URL-encoded correctly.
- **`Authentication failed`** — wrong password.
- **`SSL connection required`** — append `?sslmode=require` to `DIRECT_URL`. (Supabase's connection strings already enforce SSL by default; this is only an issue with old client versions.)

To peek at the tables visually:

```bash
npx prisma studio
```

You can also see them in the Supabase dashboard under **Database → Tables**.

---

## 8. (Recommended) Enable Row Level Security

TradeLog connects to Postgres as the `postgres` user via Prisma, which **bypasses RLS**. So security today is enforced in app code (every query in `src/app/(app)/trades/actions.ts` and the page loaders scopes by `userId`). That's fine, but RLS adds a defense-in-depth layer in case anything ever runs as `anon` or `authenticated`.

The authoritative, up-to-date policy set for **all** tables lives in [`prisma/rls_policies.sql`](prisma/rls_policies.sql) — paste that file into **SQL Editor → + New query** and run it. The Phase-1 subset below illustrates the intent:

```sql
alter table users enable row level security;
alter table trades enable row level security;
alter table tags enable row level security;
alter table trade_tags enable row level security;
alter table trade_images enable row level security;

-- Users see only their own row
create policy "users self" on users
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Trades scoped to their owner; shared trades visible to everyone signed in
create policy "trades owner" on trades
  for all using (auth.uid() = "userId") with check (auth.uid() = "userId");

create policy "trades shared read" on trades
  for select using ("isShared" = true);

create policy "tags owner" on tags
  for all using (auth.uid() = "userId") with check (auth.uid() = "userId");

create policy "trade_tags via trade" on trade_tags
  for all using (
    exists (select 1 from trades t where t.id = "tradeId" and t."userId" = auth.uid())
  ) with check (
    exists (select 1 from trades t where t.id = "tradeId" and t."userId" = auth.uid())
  );

create policy "trade_images via trade" on trade_images
  for all using (
    exists (select 1 from trades t where t.id = "tradeId" and t."userId" = auth.uid())
  ) with check (
    exists (select 1 from trades t where t.id = "tradeId" and t."userId" = auth.uid())
  );
```

Server-side Prisma queries will continue working unchanged — they connect as `postgres`, which is the table owner and bypasses RLS. The policies only kick in if anything ever queries with a user JWT (e.g., the Supabase JS client used for storage uploads in Phase 2).

---

## 9. (Phase 2) Storage bucket for trade screenshots

You can skip this until Phase 2, but it's quick to do now while you're in the dashboard.

1. **Storage → Create a new bucket**.
2. **Name:** `trade-images`
3. **Public bucket:** off (private — we'll generate signed URLs)
4. **Create bucket**.

Bucket policies (SQL Editor):

```sql
-- Authenticated users can upload to their own folder
create policy "upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'trade-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- Authenticated users can read their own folder
create policy "read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'trade-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- And delete from their own folder
create policy "delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'trade-images' and (storage.foldername(name))[1] = auth.uid()::text);
```

Code will upload to `trade-images/<user-id>/<trade-id>/<filename>` to keep this enforceable.

---

## 10. Start the dev server

```bash
npm run dev
```

Open <http://localhost:3000>. You'll be redirected to `/login`.

Click **Continue with Google** → pick a Google account that's listed as a test user (step 4b) → you should land on `/dashboard` with the empty state.

Try creating a trade from `/trades/new` to verify the full round trip.

---

## 11. Deploying to Vercel (when you're ready)

1. Push the repo to GitHub.
2. Import it in Vercel → it autodetects Next.js.
3. **Environment Variables** — paste the same vars from `.env.local`, plus override:
   ```
   NEXT_PUBLIC_SITE_URL="https://your-app.vercel.app"
   ```
4. Deploy.
5. Back in **Supabase → Authentication → URL Configuration**:
   - Update **Site URL** to your Vercel URL.
   - Add `https://your-app.vercel.app/auth/callback` and `https://your-app.vercel.app/**` to the redirect allow list.
6. Back in **Google Cloud → Credentials → your OAuth client**:
   - Add `https://your-app.vercel.app` to **Authorized JavaScript origins**.
   - The redirect URI in Google stays as `https://YOUR-REF.supabase.co/auth/v1/callback` — that doesn't change.

> You might also want to provision a **separate Supabase project for production** so you can develop against one DB without touching real trades. That just means repeating steps 1–7 with a second project and using its env vars on Vercel.

---

## Troubleshooting

**"Invalid redirect URL" after clicking Continue with Google**
The exact URL you're being redirected to is missing from Supabase's redirect allow list. Open **Authentication → URL Configuration** and add it.

**"redirect_uri_mismatch" from Google**
The callback URL Supabase sent to Google doesn't match what's registered. In Google Cloud → Credentials → your OAuth client → Authorized redirect URIs, make sure `https://YOUR-REF.supabase.co/auth/v1/callback` is there exactly (no trailing slash, no typo in the ref).

**"Access blocked: TradeLog has not completed the Google verification process"**
Your Google account isn't on the test users list. Go to OAuth consent screen → Test users → Add users.

**Login works but `requireUser()` throws on the dashboard**
Prisma can't reach the database. Check `DATABASE_URL` and `DIRECT_URL`. Make sure you ran `npx prisma migrate dev`.

**Prisma migrate fails with `prepared statement already exists`**
You have `DATABASE_URL` and `DIRECT_URL` swapped. Migrations need the direct connection (port 5432). Runtime queries should use the pooled one (port 6543).
