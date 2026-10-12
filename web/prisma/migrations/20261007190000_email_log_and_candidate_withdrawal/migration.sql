-- CreateEnum
CREATE TYPE "EmailKind" AS ENUM ('APPLICATION_RECEIVED', 'STATUS_LINK', 'LICENCE_EXPIRY', 'ADMIN_DIGEST');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'SKIPPED', 'FAILED');

-- DropForeignKey
ALTER TABLE "stage_changes" DROP CONSTRAINT "stage_changes_actorId_fkey";

-- AlterTable
ALTER TABLE "stage_changes" ADD COLUMN     "byCandidate" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "actorId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "kind" "EmailKind" NOT NULL,
    "to" VARCHAR(254) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "dedupeKey" VARCHAR(160),
    "status" "EmailStatus" NOT NULL,
    "providerId" VARCHAR(120),
    "error" TEXT,
    "applicationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_logs_dedupeKey_key" ON "email_logs"("dedupeKey");

-- CreateIndex
CREATE INDEX "email_logs_kind_createdAt_idx" ON "email_logs"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "email_logs_applicationId_idx" ON "email_logs"("applicationId");

-- AddForeignKey
ALTER TABLE "stage_changes" ADD CONSTRAINT "stage_changes_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep RLS on for every app table (the app connects server-side as table owner).
ALTER TABLE "email_logs" ENABLE ROW LEVEL SECURITY;
