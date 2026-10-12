-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "Travel" AS ENUM ('COUNTY', 'REGION', 'NATIONAL');

-- CreateEnum
CREATE TYPE "Engagement" AS ENUM ('PERMANENT', 'REGIONAL_RETAINER', 'PROJECT_CONTRACTOR', 'ANY');

-- CreateEnum
CREATE TYPE "EpraClass" AS ENUM ('T1', 'T2', 'T3', 'NONE');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'NOT_FOUND', 'MISMATCH', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('NEW', 'TECHNICAL_ASSESSMENT', 'PRACTICAL_ASSESSMENT', 'REFERENCE_CHECKS', 'APPROVED_POOL', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SocialSource" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'X', 'TIKTOK', 'WHATSAPP', 'YOUTUBE', 'DIRECT', 'OTHER');

-- CreateEnum
CREATE TYPE "InstallCategory" AS ENUM ('RESIDENTIAL', 'INSTITUTIONAL', 'COMMERCIAL_INDUSTRIAL', 'SOLAR_PUMPING', 'HYBRID', 'GRID_TIED');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('EPRA_LICENCE', 'CERTIFICATE', 'PROJECT_PHOTO', 'OTHER');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ScreeningStatus" AS ENUM ('PRIORITY_REVIEW', 'STANDARD_REVIEW', 'NEEDS_CLARIFICATION', 'BELOW_THRESHOLD', 'INELIGIBLE_LICENCE');

-- CreateEnum
CREATE TYPE "ConsentKind" AS ENUM ('RECRUITMENT_PROCESSING', 'LICENCE_VERIFICATION', 'TALENT_POOL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "fullName" VARCHAR(200) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "town" VARCHAR(120) NOT NULL,
    "county" VARCHAR(40) NOT NULL,
    "region" VARCHAR(40) NOT NULL,
    "travel" "Travel" NOT NULL DEFAULT 'COUNTY',
    "engagement" "Engagement" NOT NULL DEFAULT 'ANY',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licences" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "epraClass" "EpraClass" NOT NULL,
    "number" VARCHAR(80),
    "expiresOn" DATE,
    "issueNote" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "evidenceNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "reference" VARCHAR(32) NOT NULL,
    "candidateId" TEXT NOT NULL,
    "licenceId" TEXT,
    "stage" "Stage" NOT NULL DEFAULT 'NEW',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submissionKey" VARCHAR(64) NOT NULL,
    "source" "SocialSource" NOT NULL DEFAULT 'DIRECT',
    "utmSource" VARCHAR(100),
    "utmMedium" VARCHAR(100),
    "utmCampaign" VARCHAR(100),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "yearsExperience" DECIMAL(4,1) NOT NULL,
    "largestPvKwp" DECIMAL(10,2) NOT NULL,
    "largestInverterKw" DECIMAL(10,2),
    "largestBatteryKwh" DECIMAL(10,2),
    "largestProject" TEXT NOT NULL,
    "inverters" TEXT NOT NULL,
    "batteries" TEXT NOT NULL,
    "loggerExperience" TEXT,
    "voltageExperience" TEXT,
    "certifications" TEXT,
    "energyAuditor" BOOLEAN NOT NULL DEFAULT false,
    "highVoltage" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_categories" (
    "applicationId" TEXT NOT NULL,
    "category" "InstallCategory" NOT NULL,

    CONSTRAINT "application_categories_pkey" PRIMARY KEY ("applicationId","category")
);

-- CreateTable
CREATE TABLE "referees" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "details" TEXT NOT NULL,
    "contactedAt" TIMESTAMP(3),
    "outcome" TEXT,

    CONSTRAINT "referees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "storageKey" VARCHAR(300) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "scanStatus" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_rule_sets" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "rules" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scoring_rule_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_runs" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "experience" DECIMAL(5,2) NOT NULL,
    "technical" DECIMAL(5,2) NOT NULL,
    "verification" DECIMAL(5,2) NOT NULL,
    "total" INTEGER NOT NULL,
    "eligible" BOOLEAN NOT NULL,
    "status" "ScreeningStatus" NOT NULL,
    "breakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_changes" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStage" "Stage" NOT NULL,
    "toStage" "Stage" NOT NULL,
    "reason" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stage_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "kind" "ConsentKind" NOT NULL,
    "noticeVersion" VARCHAR(20) NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" VARCHAR(80) NOT NULL,
    "entityType" VARCHAR(40) NOT NULL,
    "entityId" VARCHAR(40) NOT NULL,
    "metadata" JSONB,
    "ip" VARCHAR(45),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_email_key" ON "candidates"("email");

-- CreateIndex
CREATE INDEX "candidates_county_idx" ON "candidates"("county");

-- CreateIndex
CREATE INDEX "candidates_region_idx" ON "candidates"("region");

-- CreateIndex
CREATE INDEX "licences_status_idx" ON "licences"("status");

-- CreateIndex
CREATE INDEX "licences_expiresOn_idx" ON "licences"("expiresOn");

-- CreateIndex
CREATE UNIQUE INDEX "applications_number_key" ON "applications"("number");

-- CreateIndex
CREATE UNIQUE INDEX "applications_reference_key" ON "applications"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "applications_submissionKey_key" ON "applications"("submissionKey");

-- CreateIndex
CREATE INDEX "applications_stage_idx" ON "applications"("stage");

-- CreateIndex
CREATE INDEX "applications_submittedAt_idx" ON "applications"("submittedAt");

-- CreateIndex
CREATE INDEX "applications_source_idx" ON "applications"("source");

-- CreateIndex
CREATE UNIQUE INDEX "referees_applicationId_position_key" ON "referees"("applicationId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "documents_storageKey_key" ON "documents"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_rule_sets_version_key" ON "scoring_rule_sets"("version");

-- CreateIndex
CREATE INDEX "score_runs_applicationId_createdAt_idx" ON "score_runs"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "score_runs_status_idx" ON "score_runs"("status");

-- CreateIndex
CREATE INDEX "stage_changes_applicationId_createdAt_idx" ON "stage_changes"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "consent_records_candidateId_kind_idx" ON "consent_records"("candidateId", "kind");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_events_actorId_createdAt_idx" ON "audit_events"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "licences" ADD CONSTRAINT "licences_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licences" ADD CONSTRAINT "licences_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_licenceId_fkey" FOREIGN KEY ("licenceId") REFERENCES "licences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_categories" ADD CONSTRAINT "application_categories_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referees" ADD CONSTRAINT "referees_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_rule_sets" ADD CONSTRAINT "scoring_rule_sets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_runs" ADD CONSTRAINT "score_runs_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_runs" ADD CONSTRAINT "score_runs_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "scoring_rule_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_changes" ADD CONSTRAINT "stage_changes_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_changes" ADD CONSTRAINT "stage_changes_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
