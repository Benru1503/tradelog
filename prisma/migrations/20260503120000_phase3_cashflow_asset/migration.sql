-- AlterTable
ALTER TABLE "cash_flows" ADD COLUMN "assetSymbol" TEXT;

-- CreateIndex
CREATE INDEX "cash_flows_userId_type_assetSymbol_idx" ON "cash_flows"("userId", "type", "assetSymbol");
