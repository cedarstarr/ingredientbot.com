-- F27: Add public sharing fields to recipes table
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "is_public" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "public_slug" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "recipes_public_slug_key" ON "recipes"("public_slug");
