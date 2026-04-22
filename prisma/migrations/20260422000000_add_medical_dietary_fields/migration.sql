-- F74: cooking_method preference on users (free-form text so adding options requires no enum migration)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cooking_method" TEXT NOT NULL DEFAULT 'any';

-- F78: spice_level preference on users (0=Mild, 1=Medium, 2=Hot, 3=Fire)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "spice_level" INTEGER NOT NULL DEFAULT 0;

-- F79: medical dietary flags on dietary_profiles
ALTER TABLE "dietary_profiles" ADD COLUMN IF NOT EXISTS "low_sodium" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "dietary_profiles" ADD COLUMN IF NOT EXISTS "low_fodmap" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "dietary_profiles" ADD COLUMN IF NOT EXISTS "diabetes_friendly" BOOLEAN NOT NULL DEFAULT false;
