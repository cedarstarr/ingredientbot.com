import { NextRequest } from 'next/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import { authLimiter } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous'

  // Symmetric rate-limit with signup / forgot / reset / password-change. Token entropy makes
  // brute-force infeasible in practice; this is defense-in-depth against accidental token-leak
  // replay storms (e.g., an email forwarder bouncing the same token thousands of times).
  const { success } = await authLimiter.check(`email-verify-change:${ip}`)
  if (!success) {
    redirect('/settings?error=rate_limited')
  }

  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    redirect('/settings?error=invalid_token')
  }

  // Wrap DB ops so a transient Prisma failure surfaces as a friendly error redirect
  // rather than a bare 500 that loses the user mid-flow.
  let userId: string
  let pendingEmail: string
  try {
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

    userId = user.id
    pendingEmail = user.pendingEmail
  } catch (err) {
    // Next.js redirect() throws a special error to trigger navigation — must rethrow
    if (err && typeof err === 'object' && 'digest' in err && typeof (err as { digest: string }).digest === 'string' && (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')) {
      throw err
    }
    redirect('/settings?error=verification_failed')
  }

  void logAuditEvent(userId, 'email_change_confirmed', ip, { email: pendingEmail })

  redirect('/settings?email_changed=1')
}
