-- CreateTable
CREATE TABLE "rate_limits" (
    "key" VARCHAR(160) NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "rate_limits_expiresAt_idx" ON "rate_limits"("expiresAt");

ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;
