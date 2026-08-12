-- Row-Level Security + Data API lockdown for TradeLog.
-- Run via the Supabase SQL editor (or psql with DIRECT_URL) AFTER
-- `prisma migrate deploy`. Re-running is safe: every statement is idempotent.
--
-- WHY THIS FILE MATTERS
-- --------------------
-- Supabase grants the `anon` and `authenticated` roles full table privileges on
-- every new table in `public` by default. Prisma creates its tables there, so
-- each migration silently handed the *public* anon key SELECT/INSERT/UPDATE/
-- DELETE/TRUNCATE on the new tables. Audited 2026-08-12: the anon key could
-- read 15 positions, 8 cash_flows, 7 watch_items, 6 predictions and 2
-- sim_snapshots, and could have truncated any of them.
--
-- This app does NOT use the Supabase Data API at all — there is not a single
-- `supabase.from(...)` call in `src/`. All database access goes through Prisma,
-- server-side, over a direct Postgres connection as the table owner (which
-- bypasses RLS). So we can close the Data API completely.
--
-- Defence in depth, in order of importance:
--   1. REVOKE the grants          -> the Data API returns nothing at all.
--   2. ENABLE RLS + policies      -> still safe if a grant is ever restored.
--   3. ALTER DEFAULT PRIVILEGES   -> future Prisma tables don't re-open the hole.
--
-- If you ever DO want client-side Supabase queries, re-grant per table
-- deliberately (`GRANT SELECT ON <table> TO authenticated;`) and lean on the
-- policies below. Do not blanket re-grant.

-- ---------------------------------------------------------------------------
-- 1. Close the Data API.
-- ---------------------------------------------------------------------------
-- service_role is deliberately untouched: the admin client (Settings ->
-- delete account) and the e2e teardown authenticate with it.

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Stop the hole reopening on the next `prisma migrate deploy`.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Enable RLS on every table in public.
-- ---------------------------------------------------------------------------
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags               ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_tags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_images       ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_revisions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flows         ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_snapshots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_symbols      ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_prices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE _prisma_migrations ENABLE ROW LEVEL SECURITY;

-- _prisma_migrations gets NO policy on purpose: RLS enabled with zero policies
-- denies everything to non-owner roles. Migration history is not user data.

-- ---------------------------------------------------------------------------
-- 3. Policies.
-- ---------------------------------------------------------------------------
-- Two conventions throughout, both required by the Supabase advisor:
--   * `(select auth.uid())` — the scalar subquery is evaluated ONCE per
--     statement instead of once per row ("Auth RLS Initialization Plan").
--   * `TO authenticated`   — un-scoped policies default to PUBLIC, which makes
--     Postgres evaluate them for every role and trips "Multiple Permissive
--     Policies".

-- 3.1 users — own profile row only.
DROP POLICY IF EXISTS users_select_self ON users;
CREATE POLICY users_select_self ON users
  FOR SELECT TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS users_update_self ON users;
CREATE POLICY users_update_self ON users
  FOR UPDATE TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- 3.2 trades — split per-command so SELECT has exactly one permissive policy.
-- The old pair (trades_owner_all FOR ALL + trades_shared_read FOR SELECT) both
-- applied to SELECT, which is what the advisor flagged five times.
DROP POLICY IF EXISTS trades_owner_all   ON trades;
DROP POLICY IF EXISTS trades_shared_read ON trades;

DROP POLICY IF EXISTS trades_select ON trades;
CREATE POLICY trades_select ON trades
  FOR SELECT TO authenticated
  USING (
    "userId" = (select auth.uid())
    OR ("isShared" = true AND "deletedAt" IS NULL)
  );

DROP POLICY IF EXISTS trades_insert ON trades;
CREATE POLICY trades_insert ON trades
  FOR INSERT TO authenticated
  WITH CHECK ("userId" = (select auth.uid()));

DROP POLICY IF EXISTS trades_update ON trades;
CREATE POLICY trades_update ON trades
  FOR UPDATE TO authenticated
  USING ("userId" = (select auth.uid()))
  WITH CHECK ("userId" = (select auth.uid()));

DROP POLICY IF EXISTS trades_delete ON trades;
CREATE POLICY trades_delete ON trades
  FOR DELETE TO authenticated
  USING ("userId" = (select auth.uid()));

-- 3.3 Straightforward owner-scoped tables.
DROP POLICY IF EXISTS tags_owner_all ON tags;
CREATE POLICY tags_owner_all ON tags
  FOR ALL TO authenticated
  USING ("userId" = (select auth.uid()))
  WITH CHECK ("userId" = (select auth.uid()));

DROP POLICY IF EXISTS trade_revisions_owner ON trade_revisions;
CREATE POLICY trade_revisions_owner ON trade_revisions
  FOR ALL TO authenticated
  USING ("userId" = (select auth.uid()))
  WITH CHECK ("userId" = (select auth.uid()));

DROP POLICY IF EXISTS positions_owner ON positions;
CREATE POLICY positions_owner ON positions
  FOR ALL TO authenticated
  USING ("userId" = (select auth.uid()))
  WITH CHECK ("userId" = (select auth.uid()));

DROP POLICY IF EXISTS cash_flows_owner ON cash_flows;
CREATE POLICY cash_flows_owner ON cash_flows
  FOR ALL TO authenticated
  USING ("userId" = (select auth.uid()))
  WITH CHECK ("userId" = (select auth.uid()));

DROP POLICY IF EXISTS watch_items_owner ON watch_items;
CREATE POLICY watch_items_owner ON watch_items
  FOR ALL TO authenticated
  USING ("userId" = (select auth.uid()))
  WITH CHECK ("userId" = (select auth.uid()));

DROP POLICY IF EXISTS sim_snapshots_owner ON sim_snapshots;
CREATE POLICY sim_snapshots_owner ON sim_snapshots
  FOR ALL TO authenticated
  USING ("userId" = (select auth.uid()))
  WITH CHECK ("userId" = (select auth.uid()));

DROP POLICY IF EXISTS predictions_owner ON predictions;
CREATE POLICY predictions_owner ON predictions
  FOR ALL TO authenticated
  USING ("userId" = (select auth.uid()))
  WITH CHECK ("userId" = (select auth.uid()));

-- 3.4 Join tables — ownership is inherited from the parent trade.
DROP POLICY IF EXISTS trade_tags_via_trade ON trade_tags;
CREATE POLICY trade_tags_via_trade ON trade_tags
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trades t
      WHERE t.id = trade_tags."tradeId"
        AND (t."userId" = (select auth.uid()) OR t."isShared" = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trades t
      WHERE t.id = trade_tags."tradeId"
        AND t."userId" = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS trade_images_via_trade ON trade_images;
CREATE POLICY trade_images_via_trade ON trade_images
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trades t
      WHERE t.id = trade_images."tradeId"
        AND (t."userId" = (select auth.uid()) OR t."isShared" = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trades t
      WHERE t.id = trade_images."tradeId"
        AND t."userId" = (select auth.uid())
    )
  );

-- 3.5 Shared reference cache — not user-owned, contains no personal data.
-- Read-only for signed-in users; writes stay server-side via Prisma.
DROP POLICY IF EXISTS asset_symbols_read ON asset_symbols;
CREATE POLICY asset_symbols_read ON asset_symbols
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS asset_prices_read ON asset_prices;
CREATE POLICY asset_prices_read ON asset_prices
  FOR SELECT TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- NOTE: server-side code connects as the table owner and therefore bypasses RLS
-- entirely. Server actions must keep enforcing ownership in application logic —
-- these policies are the second layer, not the first.
-- ---------------------------------------------------------------------------
