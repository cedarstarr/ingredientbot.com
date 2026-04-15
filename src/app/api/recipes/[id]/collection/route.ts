import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// F39: PUT /api/recipes/[id]/collection — assign recipe to a collection (or null to remove)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const recipe = await prisma.recipe.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  })
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { collectionId } = await req.json()

  try {
    // If collectionId provided, verify it belongs to this user
    if (collectionId) {
      const col = await prisma.recipeCollection.findFirst({
        where: { id: collectionId, userId: session.user.id },
        select: { id: true },
      })
      if (!col) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    const updated = await prisma.recipe.update({
      where: { id },
      data: { collectionId: collectionId ?? null },
      select: { id: true, collectionId: true },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Failed to update recipe collection' }, { status: 500 })
  }
}
