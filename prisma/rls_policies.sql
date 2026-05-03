-- Row-Level Security policies for TradeLog.
-- Run via Supabase SQL editor AFTER `prisma migrate deploy`.
-- Re-running is safe: every statement uses IF EXISTS / OR REPLACE.

-- 1. Enable RLS on every user-owned table.
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags           ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_tags     ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_images   ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_revisions ENABLE ROW LEVEL SECURITY;

-- 2. Users can see/update only their own profile row.
DROP POLICY IF EXISTS users_select_self ON users;
CREATE POLICY users_select_self ON users
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS users_update_self ON users;
CREATE POLICY users_update_self ON users
  FOR UPDATE USING (id = auth.uid());

-- 3. Trades — owner full access; others get read-only access if isShared = true.
DROP POLICY IF EXISTS trades_owner_all ON trades;
CREATE POLICY trades_owner_all ON trades
  FOR ALL USING ("userId" = auth.uid());

DROP POLICY IF EXISTS trades_shared_read ON trades;
CREATE POLICY trades_shared_read ON trades
  FOR SELECT USING ("isShared" = true AND "deletedAt" IS NULL);

-- 4. Tags — strictly per-user.
DROP POLICY IF EXISTS tags_owner_all ON tags;
CREATE POLICY tags_owner_all ON tags
  FOR ALL USING ("userId" = auth.uid());

-- 5. TradeTags — visible if you own the parent trade or it's shared.
DROP POLICY IF EXISTS trade_tags_via_trade ON trade_tags;
CREATE POLICY trade_tags_via_trade ON trade_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM trades t
      WHERE t.id = trade_tags."tradeId"
        AND (t."userId" = auth.uid() OR t."isShared" = true)
    )
  );

-- 6. TradeImages — same rule as TradeTags.
DROP POLICY IF EXISTS trade_images_via_trade ON trade_images;
CREATE POLICY trade_images_via_trade ON trade_images
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM trades t
      WHERE t.id = trade_images."tradeId"
        AND (t."userId" = auth.uid() OR t."isShared" = true)
    )
  );

-- 7. TradeRevisions — strictly owner-only. Edit history is private.
DROP POLICY IF EXISTS trade_revisions_owner ON trade_revisions;
CREATE POLICY trade_revisions_owner ON trade_revisions
  FOR ALL USING ("userId" = auth.uid());

-- NOTE: Server-side code uses the service-role key (bypasses RLS), so server
-- actions must continue to enforce ownership in application logic.
-- RLS is the second layer of defense for any client that talks to Supabase
-- directly (e.g., signed Storage URLs, future realtime subscriptions).
