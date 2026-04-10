import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// F39: PATCH /api/collections/[id] — rename/recolor a collection
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.recipeCollection.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { name, description, color } = await req.json()

  const updated = await prisma.recipeCollection.update({
    where: { id },
    data: {
      ...(name?.trim() && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(color && { color }),
    },
    include: { _count: { select: { recipes: true } } },
  })

  return NextResponse.json(updated)
}

// F39: DELETE /api/collections/[id] — delete a collection (recipes become uncollected)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.recipeCollection.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.recipeCollection.delete({ where: { id } })
  return NextResponse.json({ message: 'Deleted' })
}
