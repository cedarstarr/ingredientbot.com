import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const body = await req.json()

  const item = await prisma.pantryItem.findUnique({
    where: { id },
    select: { userId: true },
  })

  if (!item) return Response.json({ error: 'Not found' }, { status: 404 })
  if (item.userId !== session.user.id) return new Response('Forbidden', { status: 403 })

  // F26: update expiry date — pass null to clear it
  const expiresAt = body.expiresAt === null ? null : body.expiresAt ? new Date(body.expiresAt) : undefined

  const updated = await prisma.pantryItem.update({
    where: { id },
    data: { expiresAt },
    select: { id: true, ingredient: true, addedAt: true, expiresAt: true },
  })

  return Response.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return new Response('Unauthorized', { status: 401 })

  const { id } = await params

  // Verify ownership before deleting — never allow cross-user deletes
  const item = await prisma.pantryItem.findUnique({
    where: { id },
    select: { userId: true },
  })

  if (!item) return Response.json({ error: 'Not found' }, { status: 404 })
  if (item.userId !== session.user.id) return new Response('Forbidden', { status: 403 })

  await prisma.pantryItem.delete({ where: { id } })

  return new Response(null, { status: 204 })
}
