import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
