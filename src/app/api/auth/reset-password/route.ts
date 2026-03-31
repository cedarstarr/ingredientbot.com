import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPasswordChangedEmail } from '@/lib/email'
import { logAuditEvent } from '@/lib/audit'
import { authLimiter } from '@/lib/rate-limit'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await authLimiter.check(ip)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const { token, password } = body ?? {}
  if (!token || !password || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } })
  if (!resetToken || new Date() > resetToken.expires) {
    if (resetToken) await prisma.passwordResetToken.delete({ where: { token } })
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const user = await prisma.user.update({
    where: { email: resetToken.email },
    data: { password: hashedPassword },
  })

  await prisma.passwordResetToken.delete({ where: { token } })

  void logAuditEvent(user.id, 'password_reset', ip)
  try {
    await sendPasswordChangedEmail(resetToken.email, user.name ?? undefined)
  } catch { /* silent */ }

  return NextResponse.json({ message: 'Password has been reset' })
}
