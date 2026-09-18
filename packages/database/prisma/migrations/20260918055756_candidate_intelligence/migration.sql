-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('ManualEntry', 'CVImport', 'UserProvided');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('Beginner', 'Intermediate', 'Advanced', 'Expert');

-- CreateEnum
CREATE TYPE "CvImportStatus" AS ENUM ('PendingReview', 'Imported', 'Failed');

-- CreateTable
CREATE TABLE "CandidateProfile" (
    "id" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "title" TEXT,
    "emails" JSONB,
    "phones" JSONB,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "nationality" TEXT,
    "languages" JSONB,
    "workAuthorization" TEXT,
    "visaStatus" TEXT,
    "remotePreferred" BOOLEAN,
    "relocationWilling" BOOLEAN,
    "preferredLocations" JSONB,
    "targetRoles" JSONB,
    "expectedSalaryMin" INTEGER,
    "expectedSalaryMax" INTEGER,
    "currency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceRecord" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "source" "SourceType" NOT NULL DEFAULT 'UserProvided',
    "summary" TEXT,
    "rawText" TEXT NOT NULL,
    "claims" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT,
    "level" "SkillLevel" NOT NULL DEFAULT 'Intermediate',
    "years" INTEGER,
    "lastUsedYear" INTEGER,
    "frequency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceEntry" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "current" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "remote" BOOLEAN,
    "summary" TEXT,
    "technologies" JSONB,
    "responsibilities" JSONB,
    "achievements" JSONB,
    "evidenceId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperienceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEntry" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "description" TEXT,
    "technologies" JSONB,
    "achievements" JSONB,
    "url" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "current" BOOLEAN NOT NULL DEFAULT false,
    "evidenceId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationEntry" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT,
    "field" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "gpa" TEXT,
    "notes" TEXT,
    "evidenceId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EducationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificationEntry" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "credentialUrl" TEXT,
    "verificationStatus" TEXT,
    "evidenceId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievementEntry" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "date" TIMESTAMP(3),
    "url" TEXT,
    "description" TEXT,
    "evidenceId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AchievementEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvImport" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "sourceNote" TEXT,
    "status" "CvImportStatus" NOT NULL DEFAULT 'PendingReview',
    "parseSummary" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CandidateProfile_updatedAt_idx" ON "CandidateProfile"("updatedAt");

-- CreateIndex
CREATE INDEX "EvidenceRecord_profileId_idx" ON "EvidenceRecord"("profileId");

-- CreateIndex
CREATE INDEX "EvidenceRecord_source_idx" ON "EvidenceRecord"("source");

-- CreateIndex
CREATE INDEX "Skill_profileId_idx" ON "Skill"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_profileId_key_key" ON "Skill"("profileId", "key");

-- CreateIndex
CREATE INDEX "ExperienceEntry_profileId_idx" ON "ExperienceEntry"("profileId");

-- CreateIndex
CREATE INDEX "ProjectEntry_profileId_idx" ON "ProjectEntry"("profileId");

-- CreateIndex
CREATE INDEX "EducationEntry_profileId_idx" ON "EducationEntry"("profileId");

-- CreateIndex
CREATE INDEX "CertificationEntry_profileId_idx" ON "CertificationEntry"("profileId");

-- CreateIndex
CREATE INDEX "AchievementEntry_profileId_idx" ON "AchievementEntry"("profileId");

-- CreateIndex
CREATE INDEX "CvImport_profileId_idx" ON "CvImport"("profileId");

-- CreateIndex
CREATE INDEX "CvImport_createdAt_idx" ON "CvImport"("createdAt");

-- AddForeignKey
ALTER TABLE "EvidenceRecord" ADD CONSTRAINT "EvidenceRecord_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceEntry" ADD CONSTRAINT "ExperienceEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceEntry" ADD CONSTRAINT "ExperienceEntry_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEntry" ADD CONSTRAINT "ProjectEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEntry" ADD CONSTRAINT "ProjectEntry_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationEntry" ADD CONSTRAINT "EducationEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationEntry" ADD CONSTRAINT "EducationEntry_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificationEntry" ADD CONSTRAINT "CertificationEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificationEntry" ADD CONSTRAINT "CertificationEntry_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementEntry" ADD CONSTRAINT "AchievementEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementEntry" ADD CONSTRAINT "AchievementEntry_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvImport" ADD CONSTRAINT "CvImport_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
