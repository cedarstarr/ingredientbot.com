-- AlterTable
ALTER TABLE "recipe_completions" ADD COLUMN     "ai_tip" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "outcome" TEXT;

-- CreateTable
CREATE TABLE "palate_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "loved_flavors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "avoided_ingredients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "top_cuisines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "palate_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "palate_profiles_user_id_key" ON "palate_profiles"("user_id");

-- AddForeignKey
ALTER TABLE "palate_profiles" ADD CONSTRAINT "palate_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

