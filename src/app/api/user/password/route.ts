import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendPasswordChangedEmail } from '@/lib/email'
import { logAuditEvent } from '@/lib/audit'
import { authLimiter, rateLimitResponse } from '@/lib/rate-limit'
import { passwordSchema, validatePassword } from '@/lib/password-policy'
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
  if (!currentPassword || !newPassword || typeof newPassword !== 'string') {
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

  const parsedPassword = passwordSchema.safeParse(newPassword)
  if (!parsedPassword.success) {
    const issues = parsedPassword.error.issues.map((i) => i.message)
    return NextResponse.json({ error: issues[0] ?? 'Invalid password', issues }, { status: 400 })
  }
  const contextIssues = validatePassword(newPassword, { email: user.email, name: user.name })
  if (contextIssues.length > 0) {
    return NextResponse.json({ error: contextIssues[0], issues: contextIssues }, { status: 400 })
  }

  // Compare against the stored hash, not the submitted currentPassword string —
  // that's the only way to know the *new* password wasn't just re-typed.
  const sameAsCurrent = await bcrypt.compare(newPassword, user.password)
  if (sameAsCurrent) {
    return NextResponse.json({ error: 'New password must be different from your current password' }, { status: 400 })
  }

  const hashed = await bcrypt.hash(newPassword, 12)
  // Invalidate sibling sessions (other browsers/devices) on password change. Current
  // session re-issues at next request because the JWT is recreated server-side.
  // Also clears mustChangePassword — this endpoint is what /change-password posts
  // to, so a forced change is satisfied the moment this succeeds.
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      password: hashed,
      sessionsRevokedAt: new Date(),
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  })

  void logAuditEvent(session.user.id, 'password_change', ip)
  try {
    await sendPasswordChangedEmail(user.email, user.name ?? undefined)
  } catch (err) { console.error('Transactional email send failed', err) }

  return NextResponse.json({ message: 'Password updated' })
}
