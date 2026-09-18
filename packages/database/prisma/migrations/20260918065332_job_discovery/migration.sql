-- CreateEnum
CREATE TYPE "JobSourceKind" AS ENUM ('Api', 'Fixture', 'Manual');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('Active', 'Closed', 'Unknown');

-- CreateEnum
CREATE TYPE "RequirementKind" AS ENUM ('Required', 'Preferred', 'NiceToHave');

-- CreateEnum
CREATE TYPE "RequirementCategory" AS ENUM ('Skill', 'Experience', 'Education', 'Certification', 'Language', 'Other');

-- CreateEnum
CREATE TYPE "RequirementSource" AS ENUM ('Deterministic', 'AI');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceKind" "JobSourceKind" NOT NULL DEFAULT 'Api',
    "fingerprint" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "employmentType" TEXT,
    "seniority" TEXT,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT,
    "postedAt" TIMESTAMP(3),
    "status" "JobStatus" NOT NULL DEFAULT 'Active',
    "raw" JSONB,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRequirement" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "kind" "RequirementKind" NOT NULL,
    "category" "RequirementCategory" NOT NULL DEFAULT 'Skill',
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "SkillLevel",
    "minYears" INTEGER,
    "detail" TEXT,
    "source" "RequirementSource" NOT NULL DEFAULT 'Deterministic',
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceHealth" (
    "id" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "healthy" BOOLEAN NOT NULL DEFAULT true,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceHealth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_fingerprint_idx" ON "Job"("fingerprint");

-- CreateIndex
CREATE INDEX "Job_company_idx" ON "Job"("company");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Job_discoveredAt_idx" ON "Job"("discoveredAt");

-- CreateIndex
CREATE INDEX "Job_postedAt_idx" ON "Job"("postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Job_sourceName_fingerprint_key" ON "Job"("sourceName", "fingerprint");

-- CreateIndex
CREATE INDEX "JobRequirement_jobId_idx" ON "JobRequirement"("jobId");

-- CreateIndex
CREATE INDEX "JobRequirement_key_idx" ON "JobRequirement"("key");

-- CreateIndex
CREATE UNIQUE INDEX "JobRequirement_jobId_kind_category_key_key" ON "JobRequirement"("jobId", "kind", "category", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SourceHealth_sourceName_key" ON "SourceHealth"("sourceName");

-- AddForeignKey
ALTER TABLE "JobRequirement" ADD CONSTRAINT "JobRequirement_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
