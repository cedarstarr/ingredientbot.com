-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "forked_from_id" TEXT;

-- CreateIndex
CREATE INDEX "recipes_user_id_forked_from_id_idx" ON "recipes"("user_id", "forked_from_id");

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_forked_from_id_fkey" FOREIGN KEY ("forked_from_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

