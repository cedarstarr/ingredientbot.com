import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    const recipe = await prisma.recipe.findFirst({
      where: { id, userId: session.user.id },
      select: {
        id: true, title: true, description: true, cuisine: true, difficulty: true,
        servings: true, prepTimeMin: true, cookTimeMin: true, tags: true,
        rating: true, isPublic: true, publicSlug: true, cookedCount: true,
        lastCookedAt: true, collectionId: true, createdAt: true, updatedAt: true,
      },
    })
    if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(recipe)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch recipe' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    const recipe = await prisma.recipe.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    })
    if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    // Allowlist editable fields — prevents arbitrary column writes via PATCH body injection
    const { rating } = body
    const updated = await prisma.recipe.update({
      where: { id },
      data: { ...(rating !== undefined && { rating }) },
      select: { id: true, rating: true },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Failed to update recipe' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    const recipe = await prisma.recipe.findFirst({
      where: { id, userId: session.user.id }
    })
    if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.recipe.delete({ where: { id } })
    return NextResponse.json({ message: 'Deleted' })
  } catch {
    return NextResponse.json({ error: 'Failed to delete recipe' }, { status: 500 })
  }
}
