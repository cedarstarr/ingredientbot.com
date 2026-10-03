import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { FREE_TIER_MONTHLY_RECIPES } from '@/lib/limits'
import { startOfCurrentMonth } from '@/lib/date-utils'

/**
 * Create a recipe and count it against the monthly allowance atomically (FOU-691).
 *
 * The routes pre-check `isOverFreeLimit` from a row they read earlier, which is a
 * fast-path only: N concurrent requests all read the same count and all pass.
 * The real gate is the conditional UPDATE below — `recipeCount < cap` is evaluated
 * by Postgres under the row lock, so only `cap - count` of the racers get
 * `count === 1`; the rest roll the whole transaction back (no recipe is created).
 *
 * Returns null when the cap is hit. Pro accounts and a null cap always pass.
 */
export async function withMonthlyQuota<T>(
  userId: string,
  create: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T | null> {
  const monthStart = startOfCurrentMonth()
  const cap = FREE_TIER_MONTHLY_RECIPES

  return prisma.$transaction(async (tx) => {
    // Month rollover. Idempotent: a concurrent rollover matches nothing once the
    // first one has stamped monthlyResetDate, so the count is never reset twice.
    await tx.user.updateMany({
      where: { id: userId, OR: [{ monthlyResetDate: null }, { monthlyResetDate: { lt: monthStart } }] },
      data: { recipeCount: 0, monthlyResetDate: monthStart },
    })

    const { count } = await tx.user.updateMany({
      where: cap === null ? { id: userId } : { id: userId, OR: [{ isPro: true }, { recipeCount: { lt: cap } }] },
      data: { recipeCount: { increment: 1 } },
    })
    if (count === 0) return null

    return create(tx)
  })
}
