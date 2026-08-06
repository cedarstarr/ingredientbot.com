-- Allergen safety fields on recipes + new public ingredient corpus table.
--
-- `allergens` = CONFIRMED contains; `may_contain` = cross-contamination /
-- ambiguous signal. Values come from the canonical vocabulary in
-- src/lib/allergens.ts (FDA top-9 + EU-14 union). Rows are only populated via
-- the dual-model agreement gate in scripts/lib/allergen-verify.ts — absence of
-- a flag is never a "free from X" claim.
--
-- SQL generated offline with `prisma migrate diff --from-empty --to-schema`
-- (Ingredient table verbatim; recipes columns as ALTERs against the live shape).

-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "may_contain" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "allergen_notes" TEXT,
ADD COLUMN     "allergen_verified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "allergen_profile" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hidden_sources" JSONB,
    "cross_contamination" TEXT,
    "substitutions" JSONB,
    "storage" TEXT,
    "seasonality" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_slug_key" ON "ingredients"("slug");

-- CreateIndex
CREATE INDEX "ingredients_category_idx" ON "ingredients"("category");
