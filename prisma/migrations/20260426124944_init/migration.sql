-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('STOCK', 'CRYPTO', 'FOREX');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "asset" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "direction" "Direction" NOT NULL,
    "entryPrice" DECIMAL(20,8) NOT NULL,
    "exitPrice" DECIMAL(20,8),
    "quantity" DECIMAL(20,8) NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "exitDate" TIMESTAMP(3),
    "status" "TradeStatus" NOT NULL DEFAULT 'OPEN',
    "pnl" DECIMAL(20,8),
    "pnlPercent" DECIMAL(10,4),
    "fees" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_tags" (
    "tradeId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "trade_tags_pkey" PRIMARY KEY ("tradeId","tagId")
);

-- CreateTable
CREATE TABLE "trade_images" (
    "id" UUID NOT NULL,
    "tradeId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "trades_userId_entryDate_idx" ON "trades"("userId", "entryDate");

-- CreateIndex
CREATE INDEX "trades_userId_status_idx" ON "trades"("userId", "status");

-- CreateIndex
CREATE INDEX "trades_isShared_createdAt_idx" ON "trades"("isShared", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tags_userId_name_key" ON "tags"("userId", "name");

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_tags" ADD CONSTRAINT "trade_tags_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_tags" ADD CONSTRAINT "trade_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_images" ADD CONSTRAINT "trade_images_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
