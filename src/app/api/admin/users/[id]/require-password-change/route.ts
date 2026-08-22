import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.isAdmin !== true) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } })
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  await prisma.user.update({
    where: { id },
    data: { mustChangePassword: true },
  })

  const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
  void logAuditEvent(session.user.id, 'require_password_change', ip, { targetUserId: id })

  return NextResponse.json({ message: 'User will be required to change their password on next sign-in' })
}
