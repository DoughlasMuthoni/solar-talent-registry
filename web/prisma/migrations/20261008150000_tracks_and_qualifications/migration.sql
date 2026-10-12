-- CreateEnum
CREATE TYPE "QualificationLevel" AS ENUM ('TRADE_TEST', 'ARTISAN', 'CERTIFICATE', 'DIPLOMA', 'HIGHER_DIPLOMA', 'DEGREE', 'OTHER');

-- CreateEnum
CREATE TYPE "Track" AS ENUM ('EPRA_LICENSED', 'QUALIFIED');

-- AlterEnum
ALTER TYPE "DocumentKind" ADD VALUE 'QUALIFICATION';

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "track" "Track" NOT NULL DEFAULT 'EPRA_LICENSED';

-- CreateTable
CREATE TABLE "qualifications" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "level" "QualificationLevel" NOT NULL,
    "field" VARCHAR(200) NOT NULL,
    "institution" VARCHAR(200) NOT NULL,
    "yearCompleted" INTEGER NOT NULL,
    "certificateNumber" VARCHAR(80),
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "evidenceNote" TEXT,

    CONSTRAINT "qualifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "qualifications_status_idx" ON "qualifications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "qualifications_applicationId_position_key" ON "qualifications"("applicationId", "position");

-- CreateIndex
CREATE INDEX "applications_track_idx" ON "applications"("track");

-- AddForeignKey
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Same lock-down as every other table: no Data API access (default privileges were revoked in lock_down_public_api).
ALTER TABLE "qualifications" ENABLE ROW LEVEL SECURITY;

-- Applicants who said "No licence yet" before tracks existed were effectively applying as qualified technicians.
UPDATE "applications" a SET "track" = 'QUALIFIED'
FROM "licences" l WHERE a."licenceId" = l."id" AND l."epraClass" = 'NONE';
