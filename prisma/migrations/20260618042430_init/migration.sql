-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_profile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "fullName" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "linkedinEmail" TEXT,
    "sessionCookieEnc" TEXT,
    "linkedinAuthStatus" TEXT NOT NULL DEFAULT 'expired',
    "resumeUrl" TEXT,
    "yearsExperience" INTEGER,
    "education" TEXT,
    "skills" JSONB NOT NULL DEFAULT '[]',
    "desiredPosition" TEXT,
    "preferredLocation" TEXT,
    "employmentType" TEXT,
    "minSalary" INTEGER,
    "jobSort" TEXT NOT NULL DEFAULT 'recent',
    "strictExperience" BOOLEAN NOT NULL DEFAULT false,
    "strictDegree" BOOLEAN NOT NULL DEFAULT false,
    "prefilledAnswers" JSONB NOT NULL DEFAULT '{}',
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "scheduledTime" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "companyId" UUID,
    "linkedinJobId" TEXT NOT NULL,
    "title" TEXT,
    "companyName" TEXT,
    "location" TEXT,
    "employmentType" TEXT,
    "postedDate" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salarySource" TEXT,
    "description" TEXT,
    "jobUrl" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_cache" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_queue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "review_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_quota" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "autoApplied" INTEGER NOT NULL DEFAULT 0,
    "confirmedApplied" INTEGER NOT NULL DEFAULT 0,
    "totalApplied" INTEGER NOT NULL DEFAULT 0,
    "stopFlag" BOOLEAN NOT NULL DEFAULT false,
    "resetAt" TIMESTAMP(3),

    CONSTRAINT "daily_quota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "jobId" UUID,
    "linkedinJobId" TEXT NOT NULL,
    "jobTitle" TEXT,
    "company" TEXT,
    "jobUrl" TEXT,
    "agent" TEXT NOT NULL DEFAULT 'evaluator',
    "decision" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "criteria" JSONB NOT NULL DEFAULT '[]',
    "rationale" TEXT,
    "promptVersion" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_profile_userId_key" ON "candidate_profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_userId_linkedinJobId_key" ON "jobs"("userId", "linkedinJobId");

-- CreateIndex
CREATE UNIQUE INDEX "company_cache_name_key" ON "company_cache"("name");

-- CreateIndex
CREATE UNIQUE INDEX "daily_quota_userId_date_key" ON "daily_quota"("userId", "date");

-- CreateIndex
CREATE INDEX "decision_log_userId_createdAt_idx" ON "decision_log"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "candidate_profile" ADD CONSTRAINT "candidate_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company_cache"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_quota" ADD CONSTRAINT "daily_quota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_log" ADD CONSTRAINT "decision_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_log" ADD CONSTRAINT "decision_log_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
