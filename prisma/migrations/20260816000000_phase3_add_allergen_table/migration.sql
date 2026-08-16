-- CreateTable
CREATE TABLE "allergens" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regulatory_status" JSONB NOT NULL,
    "alternate_names" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hidden_sources" JSONB,
    "cross_reactivity" TEXT,
    "dining_out_guidance" TEXT,
    "disclaimer_version" TEXT NOT NULL DEFAULT 'v1-2026-08-15',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allergens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "allergens_slug_key" ON "allergens"("slug");

-- CreateIndex
CREATE INDEX "allergens_published_idx" ON "allergens"("published");

