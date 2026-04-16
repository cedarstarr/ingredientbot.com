-- Align DB column types with Prisma schema enums (F70 / meal planner).
-- Prior migrations created these columns as TEXT; schema.prisma declares them as enums,
-- so Prisma write ops fail with `type "public.chef_personality" does not exist`.

DO $$ BEGIN
  CREATE TYPE "chef_personality" AS ENUM ('home', 'french', 'street');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "meal_type" AS ENUM ('breakfast', 'lunch', 'dinner');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "users"
  ALTER COLUMN "chef_personality" DROP DEFAULT,
  ALTER COLUMN "chef_personality" TYPE "chef_personality" USING "chef_personality"::"chef_personality",
  ALTER COLUMN "chef_personality" SET DEFAULT 'home';

ALTER TABLE "meal_plan_slots"
  ALTER COLUMN "meal_type" TYPE "meal_type" USING "meal_type"::"meal_type";
