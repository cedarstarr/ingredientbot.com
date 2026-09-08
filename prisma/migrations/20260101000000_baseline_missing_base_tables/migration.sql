-- FOU-405: baseline for tables/enums that were never created by any tracked
-- migration in this chain. Root cause: this repo's schema reached staging/prod
-- via `prisma db push` before migration tracking existed for these objects, so
-- `_prisma_migrations` records them as "applied" (bulk-resolved, see
-- applied_steps_count = 0) without any migration ever containing their DDL.
-- The first migration in the tracked chain, 20260322000000_add_meal_planner,
-- assumes "users" and "recipes" already exist (FK targets) — a from-empty
-- replay fails there with `relation "users" does not exist` (P3006).
--
-- This migration is a pure ADDITIVE, IDEMPOTENT baseline:
--   - On an EMPTY database (a fresh install, or this repo's disaster-recovery
--     scenario): creates exactly what the rest of the chain expects to already
--     exist, so the full 16-migration chain replays cleanly.
--   - On the REAL staging/production databases (already fully formed via
--     db push): every statement below is a no-op, because the objects already
--     exist. Verified empirically — see FOU-405-BASELINE-RECIPE.md.
--
-- Scope rule: this file creates ONLY tables/columns/indexes/enums that are
-- NEVER created by any other migration in prisma/migrations, tracked or not.
-- Anything a later migration creates for real (even one that's itself
-- unguarded, e.g. `ALTER TABLE "recipes" ADD COLUMN "forked_from_id"`) is
-- deliberately excluded here — including it would make THIS migration collide
-- with that later, real CREATE/ADD when replayed from empty. That collision
-- (not the missing-table problem) is what sank the first FOU-405 pilot on
-- matchmymajor.ai; see the recipe doc for the full mechanism. Every column
-- below was checked against every migration.sql in this repo for exactly this
-- kind of later, unguarded creator before being included.

-- CreateEnum (never created anywhere else — "chef_personality" and
-- "meal_type" ARE created, guarded, by 20260415000000_add_chef_personality_
-- meal_type_enums, so they are intentionally NOT repeated here)
DO $$ BEGIN
  CREATE TYPE "difficulty" AS ENUM ('easy', 'medium', 'hard');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: NextAuth tables — never created by any migration
CREATE TABLE IF NOT EXISTS "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable: users — columns below are ONLY the ones no other migration
-- ever adds. Excluded on purpose (added elsewhere, some guarded, some not —
-- see file header): is_pro, recipe_count, monthly_reset_date (20260409010000,
-- guarded), budget_mode, chef_personality (20260411030000, guarded, added as
-- TEXT — 20260415000000 later ALTERs it to the enum type),
-- must_change_password, password_changed_at (20260822000000, UNGUARDED —
-- including these here would collide), cooking_method, spice_level
-- (20260422000000, guarded).
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMP(3),
    "password" TEXT,
    "name" TEXT,
    "image" TEXT,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "unsubscribe_token" TEXT,
    "email_unsubscribed_at" TIMESTAMP(3),
    "notify_marketing" BOOLEAN NOT NULL DEFAULT true,
    "notify_product" BOOLEAN NOT NULL DEFAULT true,
    "pending_email" TEXT,
    "email_change_token" TEXT,
    "email_change_expiry" TIMESTAMP(3),
    "sessions_revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "ip" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: recipes — same exclusion rule as users. Excluded: tags,
-- collection_id, cooked_count, last_cooked_at (20260409000000, guarded),
-- rating (20260411030000, guarded), is_public, public_slug (20260411020000,
-- guarded), allergens, may_contain, allergen_notes, allergen_verified_at
-- (20260804000000, UNGUARDED), non_staple_ingredient_count (20260902000000,
-- UNGUARDED), forked_from_id (20260902120000, UNGUARDED). The unguarded ones
-- are the ones that actually matter — leaving them out is what keeps this
-- baseline from re-colliding three migrations later.
CREATE TABLE IF NOT EXISTS "recipes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "servings" INTEGER NOT NULL DEFAULT 4,
    "prep_time_min" INTEGER,
    "cook_time_min" INTEGER,
    "cuisine" TEXT,
    "difficulty" "difficulty",
    "source_ingredients" TEXT[],
    "recipe_data" JSONB NOT NULL,
    "raw_text" TEXT NOT NULL,
    "nutrition" JSONB,
    "from_photo" BOOLEAN NOT NULL DEFAULT false,
    "modifications" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "job_runs" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'cron',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "success" BOOLEAN,
    "result" JSONB,
    "error" TEXT,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "admin_script_logs" (
    "id" TEXT NOT NULL,
    "script_name" TEXT NOT NULL,
    "ran_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ran_by_user_id" TEXT,
    "rows_affected" JSONB,
    "status" TEXT NOT NULL,
    "error_message" TEXT,

    CONSTRAINT "admin_script_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — only indexes not created by any other migration.
CREATE INDEX IF NOT EXISTS "accounts_user_id_idx" ON "accounts"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_session_token_key" ON "sessions"("session_token");
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "verification_tokens_token_key" ON "verification_tokens"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "users_unsubscribe_token_key" ON "users"("unsubscribe_token");
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_change_token_key" ON "users"("email_change_token");
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_key" ON "password_reset_tokens"("token");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_email_idx" ON "password_reset_tokens"("email");
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");
CREATE INDEX IF NOT EXISTS "recipes_user_id_idx" ON "recipes"("user_id");
CREATE INDEX IF NOT EXISTS "job_runs_job_started_at_idx" ON "job_runs"("job", "started_at" DESC);
CREATE INDEX IF NOT EXISTS "admin_script_logs_script_name_ran_at_idx" ON "admin_script_logs"("script_name", "ran_at" DESC);

-- AddForeignKey — guarded via pg_constraint existence check (Postgres has no
-- `ADD CONSTRAINT IF NOT EXISTS`). Only FKs targeting tables created above
-- that no other migration ever adds.
DO $$ BEGIN
  ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Second, independent bug found while proving this baseline against a full
-- from-empty replay (not visible from the static "missing relation" screen):
-- 20260802120000_repair_prod_schema_drift does an UNGUARDED
-- `DROP TABLE "AICallLog"` / `DROP TABLE "RecipeCache"` (PascalCase, no
-- @@map) before creating the real "ai_call_logs" / "recipe_caches" tables.
-- Those PascalCase tables were never created by ANY tracked migration either
-- (same db-push origin) — on a from-empty replay the DROP fails with
-- "table does not exist" the moment the replay reaches that migration.
--
-- Unlike every other object in this file, we CANNOT just create these
-- unconditionally: on staging/production, 20260802120000 already ran for
-- real months ago and already dropped them (confirmed by querying
-- information_schema.tables on staging — "AICallLog" is gone, only
-- "ai_call_logs" exists). An unconditional `CREATE TABLE IF NOT EXISTS
-- "AICallLog"` here would apply cleanly via `migrate deploy` (since THIS
-- migration is unrecorded/new) and leave a permanent, real, empty stray
-- table on staging — a genuine mutation, not a no-op, since nothing will
-- ever drop it again (20260802120000 is already marked finished and will
-- not re-run).
--
-- Fix: gate the creation on whether 20260802120000 has already finished.
-- `_prisma_migrations` already exists and is being written to by the
-- migration engine itself by the time any migration.sql runs, so this is a
-- read against real, live state, not a guess:
--   - Empty replay: this baseline runs first, long before 20260802120000
--     has a row in `_prisma_migrations` at all -> condition is TRUE -> the
--     compat tables get created -> 20260802120000 later runs for real,
--     drops them, creates the real snake_case tables. No P3006.
--   - Staging/production: 20260802120000 already has finished_at set ->
--     condition is FALSE -> nothing is created -> true no-op.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "_prisma_migrations"
    WHERE migration_name = '20260802120000_repair_prod_schema_drift'
      AND finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  ) THEN
    CREATE TABLE IF NOT EXISTS "AICallLog" (
      "id" TEXT NOT NULL,
      CONSTRAINT "AICallLog_pkey" PRIMARY KEY ("id")
    );
    CREATE TABLE IF NOT EXISTS "RecipeCache" (
      "id" TEXT NOT NULL,
      CONSTRAINT "RecipeCache_pkey" PRIMARY KEY ("id")
    );
  END IF;
END $$;
