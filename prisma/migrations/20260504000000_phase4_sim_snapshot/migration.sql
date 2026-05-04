-- CreateEnum
CREATE TYPE "SimKind" AS ENUM ('WHAT_IF', 'DCA');

-- CreateTable
CREATE TABLE "sim_snapshots" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "SimKind" NOT NULL,
    "params" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sim_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sim_snapshots_userId_createdAt_idx" ON "sim_snapshots"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "sim_snapshots" ADD CONSTRAINT "sim_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
