-- Run via Supabase SQL editor (or psql) AFTER `prisma migrate deploy`.
-- Prisma cannot express CHECK constraints natively, so they live here.

ALTER TABLE trades
  ADD CONSTRAINT trades_quantity_positive CHECK ("quantity" > 0),
  ADD CONSTRAINT trades_entry_price_nonneg CHECK ("entryPrice" >= 0),
  ADD CONSTRAINT trades_exit_price_nonneg CHECK ("exitPrice" IS NULL OR "exitPrice" >= 0),
  ADD CONSTRAINT trades_fees_nonneg CHECK ("fees" >= 0);
