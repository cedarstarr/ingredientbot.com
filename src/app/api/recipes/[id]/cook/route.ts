import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// F41: POST /api/recipes/[id]/cook — increment cookedCount and set lastCookedAt
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const recipe = await prisma.recipe.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, cookedCount: true },
  })
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.recipe.update({
    where: { id },
    data: {
      cookedCount: { increment: 1 },
      lastCookedAt: new Date(),
    },
    select: { id: true, cookedCount: true, lastCookedAt: true },
  })

  return NextResponse.json(updated)
}
