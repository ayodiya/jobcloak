-- CreateEnum
CREATE TYPE "ApplicationMaterialKind" AS ENUM ('Cv', 'CoverLetter', 'Answer');

-- CreateEnum
CREATE TYPE "ApplicationMaterialStatus" AS ENUM ('Draft', 'Ready', 'Review');

-- CreateTable
CREATE TABLE "EvidenceSnapshot" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "evidenceIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationMaterial" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "kind" "ApplicationMaterialKind" NOT NULL,
    "jobId" TEXT NOT NULL DEFAULT '',
    "key" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ApplicationMaterialStatus" NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialVersion" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "draft" JSONB,
    "promptId" TEXT NOT NULL,
    "promptVersion" INTEGER NOT NULL,
    "aiModel" TEXT,
    "snapshotId" TEXT,
    "factuality" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvidenceSnapshot_profileId_idx" ON "EvidenceSnapshot"("profileId");

-- CreateIndex
CREATE INDEX "EvidenceSnapshot_hash_idx" ON "EvidenceSnapshot"("hash");

-- CreateIndex
CREATE INDEX "ApplicationMaterial_profileId_kind_idx" ON "ApplicationMaterial"("profileId", "kind");

-- CreateIndex
CREATE INDEX "ApplicationMaterial_jobId_idx" ON "ApplicationMaterial"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationMaterial_profileId_kind_jobId_key_key" ON "ApplicationMaterial"("profileId", "kind", "jobId", "key");

-- CreateIndex
CREATE INDEX "MaterialVersion_materialId_idx" ON "MaterialVersion"("materialId");

-- CreateIndex
CREATE INDEX "MaterialVersion_snapshotId_idx" ON "MaterialVersion"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialVersion_materialId_version_key" ON "MaterialVersion"("materialId", "version");

-- AddForeignKey
ALTER TABLE "EvidenceSnapshot" ADD CONSTRAINT "EvidenceSnapshot_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationMaterial" ADD CONSTRAINT "ApplicationMaterial_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialVersion" ADD CONSTRAINT "MaterialVersion_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "ApplicationMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialVersion" ADD CONSTRAINT "MaterialVersion_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "EvidenceSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
