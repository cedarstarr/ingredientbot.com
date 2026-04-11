-- F31: Dietary profile (persistent preferences across all generations)
CREATE TABLE "dietary_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "restrictions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "cuisine_prefs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "disliked_ingredients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dietary_profiles_pkey" PRIMARY KEY ("id")
);

-- F44: Pantry inventory (persistent ingredient list tracked between sessions)
CREATE TABLE "pantry_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ingredient" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pantry_items_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "dietary_profiles_user_id_key" ON "dietary_profiles"("user_id");
CREATE UNIQUE INDEX "pantry_items_user_id_ingredient_key" ON "pantry_items"("user_id", "ingredient");
CREATE INDEX "pantry_items_user_id_idx" ON "pantry_items"("user_id");

-- Foreign keys
ALTER TABLE "dietary_profiles" ADD CONSTRAINT "dietary_profiles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pantry_items" ADD CONSTRAINT "pantry_items_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
