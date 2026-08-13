-- CreateTable
CREATE TABLE "coach_reports" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "factsHash" TEXT NOT NULL,
    "facts" JSONB NOT NULL,
    "report" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "tradesCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coach_reports_userId_createdAt_idx" ON "coach_reports"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "coach_reports_userId_factsHash_idx" ON "coach_reports"("userId", "factsHash");

-- AddForeignKey
ALTER TABLE "coach_reports" ADD CONSTRAINT "coach_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
