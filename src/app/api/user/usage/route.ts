import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const FREE_TIER_LIMIT = 5

function startOfCurrentMonth(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

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
