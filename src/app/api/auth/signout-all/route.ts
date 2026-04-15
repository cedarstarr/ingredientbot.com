import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { sessionsRevokedAt: new Date() },
    })

    await prisma.session.deleteMany({ where: { userId: session.user.id } })

    void logAuditEvent(session.user.id, 'signout_all', null)

    return NextResponse.json({ message: 'All sessions revoked' })
  } catch {
    return NextResponse.json({ error: 'Failed to revoke sessions' }, { status: 500 })
  }
}
