import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfCurrentMonth } from '@/lib/date-utils'

const FREE_TIER_LIMIT = 5

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isPro: true, recipeCount: true, monthlyResetDate: true },
    })

    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const monthStart = startOfCurrentMonth()
    const needsReset = !user.monthlyResetDate || user.monthlyResetDate < monthStart
    const count = needsReset ? 0 : user.recipeCount

    return NextResponse.json({
      isPro: user.isPro,
      used: count,
      limit: FREE_TIER_LIMIT,
      remaining: user.isPro ? null : Math.max(0, FREE_TIER_LIMIT - count),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 })
  }
}
