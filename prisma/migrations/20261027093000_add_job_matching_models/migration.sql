-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "employmentType" TEXT,
ADD COLUMN     "experienceLevel" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "postedAt" TIMESTAMP(3),
ADD COLUMN     "remoteStatus" TEXT,
ADD COLUMN     "salary" TEXT,
ADD COLUMN     "sourceJobId" TEXT,
ADD COLUMN     "url" TEXT;

-- CreateTable
CREATE TABLE "JobMatch" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "resumeId" INTEGER NOT NULL,
    "jobId" INTEGER NOT NULL,
    "matchScore" INTEGER NOT NULL,
    "requiredSkillsMatched" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredSkillsMissing" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredSkillsMatched" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredSkillsMissing" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unassessedSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experienceLevelAlignment" TEXT,
    "seniorityAlignment" TEXT,
    "reasonsForMatch" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summary" TEXT,
    "rawClaudeAnalysis" TEXT,
    "inputHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobMatch_userId_matchScore_idx" ON "JobMatch"("userId", "matchScore");

-- CreateIndex
CREATE INDEX "JobMatch_jobId_idx" ON "JobMatch"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "JobMatch_userId_resumeId_jobId_key" ON "JobMatch"("userId", "resumeId", "jobId");

-- CreateIndex
CREATE INDEX "Job_source_sourceJobId_idx" ON "Job"("source", "sourceJobId");

-- CreateIndex
CREATE INDEX "Job_isActive_idx" ON "Job"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_userId_jobId_key" ON "JobApplication"("userId", "jobId");

-- AddForeignKey
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
