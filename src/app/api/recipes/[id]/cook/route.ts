import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// F41: POST /api/recipes/[id]/cook — increment cookedCount and set lastCookedAt
// F47: also log to RecipeCompletion for streak tracking
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const recipe = await prisma.recipe.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, cookedCount: true },
  })
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    // Run both writes in parallel — chosen over a transaction because both are low-stakes inserts
    const [updated, completion] = await Promise.all([
      prisma.recipe.update({
        where: { id },
        data: {
          cookedCount: { increment: 1 },
          lastCookedAt: new Date(),
        },
        select: { id: true, cookedCount: true, lastCookedAt: true },
      }),
      prisma.recipeCompletion.create({
        data: { userId: session.user.id, recipeId: id },
      }),
    ])
    // F88: completionId lets the client follow up with a cook-feedback POST
    // (outcome/note/AI tip) against the exact completion row it caused.
    return NextResponse.json({ ...updated, completionId: completion.id })
  } catch {
    return NextResponse.json({ error: 'Failed to record cook' }, { status: 500 })
  }
}
