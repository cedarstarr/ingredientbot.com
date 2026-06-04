import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendPasswordChangedEmail } from '@/lib/email'
import { logAuditEvent } from '@/lib/audit'
import { authLimiter, rateLimitResponse } from '@/lib/rate-limit'
import bcrypt from 'bcryptjs'

export async function PATCH(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await authLimiter.check(`password-change:${ip}`)
  if (!success) return rateLimitResponse()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const { currentPassword, newPassword } = body ?? {}
  if (!currentPassword || !newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, password: true, email: true, name: true },
  })
  if (!user?.password) {
    return NextResponse.json({ error: 'No password set' }, { status: 400 })
  }

  const valid = await bcrypt.compare(currentPassword, user.password)
  if (!valid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
  }

  const hashed = await bcrypt.hash(newPassword, 12)
  // Invalidate sibling sessions (other browsers/devices) on password change. Current
  // session re-issues at next request because the JWT is recreated server-side.
  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: hashed, sessionsRevokedAt: new Date() },
  })

  void logAuditEvent(session.user.id, 'password_change', ip)
  try {
    await sendPasswordChangedEmail(user.email, user.name ?? undefined)
  } catch { /* silent */ }

  return NextResponse.json({ message: 'Password updated' })
}
