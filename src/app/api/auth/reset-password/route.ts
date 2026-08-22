import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPasswordChangedEmail } from '@/lib/email'
import { logAuditEvent } from '@/lib/audit'
import { authLimiter } from '@/lib/rate-limit'
import { passwordSchema, validatePassword } from '@/lib/password-policy'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await authLimiter.check(ip)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const { token, password } = body ?? {}
  if (!token || !password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const parsedPassword = passwordSchema.safeParse(password)
  if (!parsedPassword.success) {
    const issues = parsedPassword.error.issues.map((i) => i.message)
    return NextResponse.json({ error: issues[0] ?? 'Invalid input', issues }, { status: 400 })
  }

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } })
  if (!resetToken || new Date() > resetToken.expires) {
    if (resetToken) await prisma.passwordResetToken.delete({ where: { token } })
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
  }

  // Personal-info rule needs the account email, only known once the token resolves.
  const existingUser = await prisma.user.findUnique({
    where: { email: resetToken.email },
    select: { name: true },
  })
  const contextIssues = validatePassword(password, { email: resetToken.email, name: existingUser?.name })
  if (contextIssues.length > 0) {
    return NextResponse.json({ error: contextIssues[0], issues: contextIssues }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  // Bump sessionsRevokedAt so any existing JWT sessions for the account become invalid.
  // Without this an attacker who stole a session cookie keeps access after the user resets their password.
  // Also clears any forced-password-change flag — a reset already establishes a
  // fresh, policy-compliant password, so there's nothing left to force.
  const user = await prisma.user.update({
    where: { email: resetToken.email },
    data: {
      password: hashedPassword,
      sessionsRevokedAt: new Date(),
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  })

  await prisma.passwordResetToken.delete({ where: { token } })

  void logAuditEvent(user.id, 'password_reset', ip)
  try {
    await sendPasswordChangedEmail(resetToken.email, user.name ?? undefined)
  } catch (err) { console.error('Transactional email send failed', err) }

  return NextResponse.json({ message: 'Password has been reset' })
}
