-- F38: Recipe tagging
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}';

-- F39: Recipe collections/folders
CREATE TABLE IF NOT EXISTS "recipe_collections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#22c55e',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_collections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "recipe_collections_user_id_idx" ON "recipe_collections"("user_id");

ALTER TABLE "recipe_collections" DROP CONSTRAINT IF EXISTS "recipe_collections_user_id_fkey";
ALTER TABLE "recipe_collections" ADD CONSTRAINT "recipe_collections_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- F39: Add collection FK to recipes
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "collection_id" TEXT;

CREATE INDEX IF NOT EXISTS "recipes_collection_id_idx" ON "recipes"("collection_id");

ALTER TABLE "recipes" DROP CONSTRAINT IF EXISTS "recipes_collection_id_fkey";
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_collection_id_fkey"
    FOREIGN KEY ("collection_id") REFERENCES "recipe_collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- F41: Completion tracking
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "cooked_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "last_cooked_at" TIMESTAMP(3);
