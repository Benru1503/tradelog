# Prerequisites

Everything your machine needs **before** you try to run TradeLog. Five minutes here saves an hour of "works in CI, breaks on my laptop" — every item below has burned someone already.

## Required software

| Tool | Minimum version | Why this minimum                                                                                                 | Verify          |
| ---- | --------------- | ---------------------------------------------------------------------------------------------------------------- | --------------- |
| Node | **20.19**       | First Node 20 with `require(esm)` enabled — vitest 4 / jsdom hard-crash with `ERR_REQUIRE_ESM` on anything older | `node -v`       |
| npm  | 10+             | Ships with Node 20; the lockfile is npm-format (don't use yarn/pnpm here)                                        | `npm -v`        |
| Git  | any recent      | Line endings are handled by the repo's `.gitattributes` — no `core.autocrlf` tuning needed                       | `git --version` |

Quick self-check (all three at once):

```bash
node -v && npm -v && git --version
```

If `node -v` prints something below `v20.19`, **stop and upgrade first** — everything will install fine and then the test runner will die with confusing ESM errors. Windows: `winget install OpenJS.NodeJS.LTS` or use [nvm-windows](https://github.com/coreybutler/nvm-windows). macOS/Linux: `nvm install 20` (`.nvmrc` pins the major).

## Required accounts & secrets

You need **one** of these two paths:

1. **Joining the existing team project (usual case):** get `.env.local` from a teammate — it carries the shared Supabase URL/keys, DB connection strings, `TEST_AUTH_SECRET`, and a Finnhub key. Also ask to be added as a **test user** on the Google OAuth consent screen, or the login screen will block you with "app has not completed verification".
2. **Standing up your own stack:** a free [Supabase](https://supabase.com) account + a [Google Cloud](https://console.cloud.google.com) account for the OAuth client. Full walkthrough: [SETUP.md](../SETUP.md).

Optional but recommended:

- [Finnhub](https://finnhub.io) free API key — without it every **stock/forex** price surface shows `—`.
- [CoinGecko](https://www.coingecko.com/en/api) demo key — crypto works keyless; the key only raises rate limits.

`.env.local` is **gitignored and must stay that way** — it contains the Supabase `service_role` key, which bypasses row-level security.

## Machine notes

- **Windows + OneDrive:** keeping the clone inside a OneDrive-synced folder works but npm installs get flaky (file locks mid-install) and everything is slower. Prefer a non-synced path like `C:\dev\tradelog`; at minimum pause OneDrive sync during `npm install`. Known symptom + fix in [testing.md](testing.md#windows--onedrive-notes).
- **Line endings:** nothing to configure — `.gitattributes` forces LF everywhere. If you cloned before that file existed, see the re-smudge recipe in [testing.md](testing.md#environment-requirements).
- **Disk:** ~500 MB for `node_modules`, plus ~300 MB if you install Playwright browsers for E2E (`npx playwright install chromium`).

## Ready?

Continue to **[running-locally.md](running-locally.md)** for the step-by-step.
