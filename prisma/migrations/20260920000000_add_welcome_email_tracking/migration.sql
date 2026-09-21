-- AlterTable
ALTER TABLE "users" ADD COLUMN     "welcome_email_sent_at" TIMESTAMP(3),
ADD COLUMN     "welcome_email_attempts" INTEGER NOT NULL DEFAULT 0;

-- Backfill so the first run of the record-based query is not a mass re-send.
-- The old job selected on a 25-hour lookback, so anyone older than that had
-- already been sent to (or already been passed by) and must not be picked up
-- again by the new, wider 7-day sanity bound. Anyone still inside the old
-- window stays eligible, exactly as they were before this change.
UPDATE "users"
SET "welcome_email_sent_at" = "created_at"
WHERE "created_at" < NOW() - INTERVAL '25 hours';
