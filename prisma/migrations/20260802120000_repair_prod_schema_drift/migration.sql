-- Repair production schema drift.
--
-- Models were added to schema.prisma and reached staging via `prisma db push`,
-- which writes no migration files. Production applies migrations and so never
-- received them, leaving prod tables that do not match the schema the app queries.
--
-- Generated with `prisma migrate diff` from production's actual schema, and
-- dry-run verified on a scratch copy of production before being applied.

-- DropTable
DROP TABLE "AICallLog";

-- DropTable
DROP TABLE "RecipeCache";

-- CreateTable
CREATE TABLE "ai_call_logs" (
    "id" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_caches" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "output" JSONB NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_caches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_call_logs_createdAt_idx" ON "ai_call_logs"("createdAt");

-- CreateIndex
CREATE INDEX "ai_call_logs_site_idx" ON "ai_call_logs"("site");

-- CreateIndex
CREATE INDEX "ai_call_logs_feature_idx" ON "ai_call_logs"("feature");

-- CreateIndex
CREATE INDEX "ai_call_logs_userId_idx" ON "ai_call_logs"("userId");

-- CreateIndex
CREATE INDEX "recipe_caches_feature_lastHitAt_idx" ON "recipe_caches"("feature", "lastHitAt");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_caches_feature_inputHash_key" ON "recipe_caches"("feature", "inputHash");

