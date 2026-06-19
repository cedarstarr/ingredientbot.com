/**
 * Shared Prisma client for standalone scripts (seeds, cron sync).
 * Prisma 7 requires a driver adapter — bare `new PrismaClient()` throws.
 * DATABASE_URL is read from the env the script is invoked with (e.g. the
 * staging URL passed by /build-seed).
 */
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
export const prisma = new PrismaClient({ adapter })
