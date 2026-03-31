import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { authLimiter, rateLimitResponse } from '@/lib/rate-limit'
import { sendEmailChangeVerificationEmail } from '@/lib/email'
import { logAuditEvent } from '@/lib/audit'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const emailChangeSchema = z.object({
  newEmail: z.string().email(),
  currentPassword: z.string().min(1, 'Password is required'),
})

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
    const { success } = await authLimiter.check(`email-change:${ip}`)
    if (!success) return rateLimitResponse()

    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    const body = await request.json()
    const parsed = emailChangeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }
    const { newEmail, currentPassword } = parsed.data

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, password: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.password) {
      return NextResponse.json({ error: 'Password-based authentication is not available for this account' }, { status: 400 })
    }

    if (newEmail === user.email) {
      return NextResponse.json({ error: 'Same as current email' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password)
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
    }

    const token = randomBytes(32).toString('hex')
    const expiry = new Date(Date.now() + 3600000) // 1 hour

    await prisma.user.update({
      where: { id: userId },
      data: {
        pendingEmail: newEmail,
        emailChangeToken: token,
        emailChangeExpiry: expiry,
      },
    })

    await sendEmailChangeVerificationEmail(newEmail, token)

    void logAuditEvent(userId, 'email_change_requested', ip, { newEmail })

    return NextResponse.json({ message: 'Verification email sent to your new address' })
  } catch (error) {
    console.error('Email change error:', error)
    return NextResponse.json({ error: 'Failed to process email change' }, { status: 500 })
  }
}
