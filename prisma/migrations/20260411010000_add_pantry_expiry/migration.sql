-- F26: Expiry-first mode — add expires_at to pantry_items
ALTER TABLE "pantry_items" ADD COLUMN "expires_at" TIMESTAMP(3);
