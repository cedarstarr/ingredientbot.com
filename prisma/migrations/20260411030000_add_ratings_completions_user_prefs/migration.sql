-- F51: Add rating field to recipes
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "rating" INTEGER;

-- F53: Add budget_mode to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "budget_mode" BOOLEAN NOT NULL DEFAULT false;

-- F70: Add chef_personality to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "chef_personality" TEXT NOT NULL DEFAULT 'home';

-- F47: Create recipe_completions table for streak tracking
CREATE TABLE IF NOT EXISTS "recipe_completions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "cooked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_completions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "recipe_completions_user_id_cooked_at_idx" ON "recipe_completions"("user_id", "cooked_at" DESC);
CREATE INDEX IF NOT EXISTS "recipe_completions_recipe_id_idx" ON "recipe_completions"("recipe_id");

ALTER TABLE "recipe_completions" ADD CONSTRAINT "recipe_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_completions" ADD CONSTRAINT "recipe_completions_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
