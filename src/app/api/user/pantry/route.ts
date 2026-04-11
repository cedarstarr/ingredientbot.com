import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user) return new Response('Unauthorized', { status: 401 })

  const items = await prisma.pantryItem.findMany({
    where: { userId: session.user.id },
    orderBy: { addedAt: 'desc' },
    select: { id: true, ingredient: true, addedAt: true, expiresAt: true },
  })

  return Response.json(items)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json()
  const ingredient = typeof body.ingredient === 'string' ? body.ingredient.trim().toLowerCase() : ''
  // F26: optional expiry date — parse and validate if provided
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null

  if (!ingredient) {
    return Response.json({ error: 'ingredient is required' }, { status: 400 })
  }

  // upsert to handle duplicates gracefully — schema has a unique index on (userId, ingredient)
  const item = await prisma.pantryItem.upsert({
    where: { userId_ingredient: { userId: session.user.id, ingredient } },
    create: { userId: session.user.id, ingredient, expiresAt },
    update: {}, // already exists — no-op
    select: { id: true, ingredient: true, addedAt: true, expiresAt: true },
  })

  return Response.json(item, { status: 201 })
}
