import { NextRequest } from 'next/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    redirect('/settings?error=invalid_token')
  }

  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous'

  const user = await prisma.user.findUnique({
    where: { emailChangeToken: token },
    select: {
      id: true,
      email: true,
      pendingEmail: true,
      emailChangeExpiry: true,
    },
  })

  if (!user) {
    redirect('/settings?error=invalid_token')
  }

  if (!user.emailChangeExpiry || user.emailChangeExpiry < new Date()) {
    redirect('/settings?error=token_expired')
  }

  if (!user.pendingEmail) {
    redirect('/settings?error=invalid_token')
  }

  const existing = await prisma.user.findUnique({
    where: { email: user.pendingEmail },
    select: { id: true },
  })
  if (existing) {
    redirect('/settings?error=email_taken')
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      email: user.pendingEmail,
      pendingEmail: null,
      emailChangeToken: null,
      emailChangeExpiry: null,
    },
  })

  void logAuditEvent(user.id, 'email_change_confirmed', ip, { email: user.pendingEmail })

  redirect('/settings?email_changed=1')
}
