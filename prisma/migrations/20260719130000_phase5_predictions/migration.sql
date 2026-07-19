-- CreateEnum
CREATE TYPE "PredictionHorizon" AS ENUM ('D1', 'W1');

-- CreateEnum
CREATE TYPE "PredictionDirection" AS ENUM ('UP', 'DOWN');

-- CreateEnum
CREATE TYPE "PredictionOutcome" AS ENUM ('HIT', 'MISS');

-- CreateTable
CREATE TABLE "predictions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "horizon" "PredictionHorizon" NOT NULL,
    "direction" "PredictionDirection" NOT NULL,
    "pUp" DECIMAL(6,5) NOT NULL,
    "priceAt" DECIMAL(20,8) NOT NULL,
    "candleTime" TIMESTAMP(3) NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvesAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedPrice" DECIMAL(20,8),
    "outcome" "PredictionOutcome",

    CONSTRAINT "predictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "predictions_userId_createdAt_idx" ON "predictions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "predictions_userId_resolvesAt_idx" ON "predictions"("userId", "resolvesAt");

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
