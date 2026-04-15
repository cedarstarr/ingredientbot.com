import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Generate a short unique slug using cuid-style randomness without external deps
function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  // 8-char random slug → 36^8 ≈ 2.8 trillion combinations, collision risk negligible
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// POST /api/recipes/[id]/share — enable public sharing, return permalink
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const recipe = await prisma.recipe.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, publicSlug: true, isPublic: true },
  })
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    // Reuse existing slug if already shared — idempotent
    let slug = recipe.publicSlug
    if (!slug) {
      // Collision-safe: retry up to 5 times (practically never needed)
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateSlug()
        const existing = await prisma.recipe.findUnique({ where: { publicSlug: candidate }, select: { id: true } })
        if (!existing) { slug = candidate; break }
      }
      if (!slug) return NextResponse.json({ error: 'Failed to generate unique slug' }, { status: 500 })
    }

    await prisma.recipe.update({
      where: { id },
      data: { isPublic: true, publicSlug: slug },
    })

    const host = req.headers.get('host') ?? 'ingredientbot.com'
    const protocol = req.headers.get('x-forwarded-proto') ?? 'https'
    const url = `${protocol}://${host}/r/${slug}`
    return NextResponse.json({ url, slug })
  } catch {
    return NextResponse.json({ error: 'Failed to share recipe' }, { status: 500 })
  }
}

// DELETE /api/recipes/[id]/share — revoke public link
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const recipe = await prisma.recipe.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    })
    if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.recipe.update({
      where: { id },
      data: { isPublic: false, publicSlug: null },
    })
    return NextResponse.json({ revoked: true })
  } catch {
    return NextResponse.json({ error: 'Failed to revoke share' }, { status: 500 })
  }
}
