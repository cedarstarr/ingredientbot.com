import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// F39: GET /api/collections — list all collections for current user
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const collections = await prisma.recipeCollection.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { recipes: true } },
      },
    })
    return NextResponse.json(collections)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 })
  }
}

// F39: POST /api/collections — create a new collection
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, color } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  try {
    const collection = await prisma.recipeCollection.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || '#22c55e',
      },
      include: { _count: { select: { recipes: true } } },
    })
    return NextResponse.json(collection, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create collection' }, { status: 500 })
  }
}
