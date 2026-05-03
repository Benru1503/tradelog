-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CashFlowType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'DIVIDEND', 'FEE_ADJUST');

-- CreateEnum
CREATE TYPE "TargetDirection" AS ENUM ('BUY', 'SELL');

-- AlterTable
ALTER TABLE "trades" ADD COLUMN     "positionId" UUID;

-- CreateTable
CREATE TABLE "positions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "asset" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "direction" "Direction" NOT NULL,
    "status" "PositionStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "avgCost" DECIMAL(20,8) NOT NULL,
    "totalQty" DECIMAL(20,8) NOT NULL,
    "realizedPnl" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_flows" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "CashFlowType" NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watch_items" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "asset" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "targetPrice" DECIMAL(20,8),
    "targetDirection" "TargetDirection",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watch_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_symbols" (
    "id" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "exchange" TEXT,
    "sector" TEXT,
    "industry" TEXT,
    "dividendYield" DECIMAL(10,6),
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_symbols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_prices" (
    "symbolId" UUID NOT NULL,
    "price" DECIMAL(20,8) NOT NULL,
    "changePct" DECIMAL(10,4),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_prices_pkey" PRIMARY KEY ("symbolId")
);

-- CreateIndex
CREATE INDEX "positions_userId_status_asset_idx" ON "positions"("userId", "status", "asset");

-- CreateIndex
CREATE INDEX "positions_userId_openedAt_idx" ON "positions"("userId", "openedAt");

-- CreateIndex
CREATE INDEX "cash_flows_userId_occurredAt_idx" ON "cash_flows"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "cash_flows_userId_type_idx" ON "cash_flows"("userId", "type");

-- CreateIndex
CREATE INDEX "watch_items_userId_createdAt_idx" ON "watch_items"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "watch_items_userId_asset_key" ON "watch_items"("userId", "asset");

-- CreateIndex
CREATE INDEX "asset_symbols_symbol_idx" ON "asset_symbols"("symbol");

-- CreateIndex
CREATE INDEX "asset_symbols_assetType_sector_idx" ON "asset_symbols"("assetType", "sector");

-- CreateIndex
CREATE UNIQUE INDEX "asset_symbols_symbol_assetType_key" ON "asset_symbols"("symbol", "assetType");

-- CreateIndex
CREATE INDEX "trades_positionId_idx" ON "trades"("positionId");

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_flows" ADD CONSTRAINT "cash_flows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_items" ADD CONSTRAINT "watch_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_prices" ADD CONSTRAINT "asset_prices_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "asset_symbols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

