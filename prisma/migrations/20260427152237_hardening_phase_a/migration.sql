-- AlterTable
ALTER TABLE "trades" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "timezone" TEXT;

-- CreateTable
CREATE TABLE "trade_revisions" (
    "id" UUID NOT NULL,
    "tradeId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,

    CONSTRAINT "trade_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trade_revisions_tradeId_changedAt_idx" ON "trade_revisions"("tradeId", "changedAt");

-- CreateIndex
CREATE INDEX "trade_revisions_userId_changedAt_idx" ON "trade_revisions"("userId", "changedAt");

-- CreateIndex
CREATE INDEX "trades_userId_assetType_idx" ON "trades"("userId", "assetType");

-- CreateIndex
CREATE INDEX "trades_userId_deletedAt_idx" ON "trades"("userId", "deletedAt");

-- AddForeignKey
ALTER TABLE "trade_revisions" ADD CONSTRAINT "trade_revisions_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_revisions" ADD CONSTRAINT "trade_revisions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
