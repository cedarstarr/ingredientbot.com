import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// F38: PUT /api/recipes/[id]/tags — replace all tags on a recipe
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const recipe = await prisma.recipe.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  })
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { tags } = await req.json()
  if (!Array.isArray(tags)) return NextResponse.json({ error: 'tags must be an array' }, { status: 400 })

  // Deduplicate + trim + lowercase
  const cleaned = [...new Set((tags as string[]).map(t => t.trim().toLowerCase()).filter(Boolean))]

  try {
    const updated = await prisma.recipe.update({
      where: { id },
      data: { tags: cleaned },
      select: { id: true, tags: true },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Failed to update tags' }, { status: 500 })
  }
}
