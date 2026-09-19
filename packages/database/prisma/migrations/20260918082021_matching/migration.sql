-- CreateTable
CREATE TABLE "JobMatch" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "totalScore" DOUBLE PRECISION NOT NULL,
    "eligible" BOOLEAN NOT NULL DEFAULT true,
    "confidence" DOUBLE PRECISION NOT NULL,
    "disqualifiers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobMatchDimension" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "applicable" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobMatchDimension_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobMatch_jobId_key" ON "JobMatch"("jobId");

-- CreateIndex
CREATE INDEX "JobMatch_eligible_idx" ON "JobMatch"("eligible");

-- CreateIndex
CREATE INDEX "JobMatch_totalScore_idx" ON "JobMatch"("totalScore");

-- CreateIndex
CREATE INDEX "JobMatch_company_idx" ON "JobMatch"("company");

-- CreateIndex
CREATE INDEX "JobMatchDimension_matchId_idx" ON "JobMatchDimension"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "JobMatchDimension_matchId_key_key" ON "JobMatchDimension"("matchId", "key");

-- AddForeignKey
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMatchDimension" ADD CONSTRAINT "JobMatchDimension_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "JobMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
