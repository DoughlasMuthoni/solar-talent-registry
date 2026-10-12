-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('TECHNICAL', 'PRACTICAL');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssessmentResult" AS ENUM ('PASS', 'FAIL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EmailKind" ADD VALUE 'ASSESSMENT_INVITE';
ALTER TYPE "EmailKind" ADD VALUE 'ADMIN_MESSAGE';

-- AlterTable
ALTER TABLE "email_logs" ADD COLUMN     "body" TEXT,
ADD COLUMN     "sentById" TEXT;

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" "AssessmentType" NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "location" VARCHAR(200) NOT NULL,
    "instructions" TEXT,
    "result" "AssessmentResult",
    "score" INTEGER,
    "notes" TEXT,
    "assessorId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessments_status_scheduledAt_idx" ON "assessments"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "assessments_applicationId_idx" ON "assessments"("applicationId");

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "assessments" ENABLE ROW LEVEL SECURITY;
