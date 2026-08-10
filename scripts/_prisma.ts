/**
 * Shared Prisma client for standalone scripts (seeds, cron sync).
 * Prisma 7 requires a driver adapter — bare `new PrismaClient()` throws.
 * DATABASE_URL is read from the env the script is invoked with (e.g. the
 * staging URL passed by /build-seed).
 */
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'


// An unset or empty DATABASE_URL makes PrismaPg silently default to
// 127.0.0.1:5432, so the failure surfaces as a confusing "Can't reach database
// server at 127.0.0.1:5432" (P1001) instead of naming the real cause. Scripts
// do not load .env — the URL is always passed in by the caller — so refuse
// rather than connect somewhere nobody asked for.
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Scripts do not read .env — pass it explicitly, e.g. ' +
      'DATABASE_URL="$(grep -m1 \'^DATABASE_URL\' .env | cut -d\'"\' -f2)" npx tsx scripts/<name>.ts',
  )
}

const adapter = new PrismaPg({ connectionString })
export const prisma = new PrismaClient({ adapter })
