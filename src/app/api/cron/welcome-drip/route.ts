import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWelcomeEmail } from '@/lib/email'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()

  // Day 1: users created in last 25 hours who haven't received a drip yet
  const oneDayAgo = new Date(Date.now() - 25 * 3600 * 1000)
  const newUsers = await prisma.user.findMany({
    where: {
      createdAt: { gte: oneDayAgo },
      notifyMarketing: true,
      emailVerified: { not: null },
    },
    select: { id: true, email: true, name: true }
  })

  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const user of newUsers) {
    try {
      await sendWelcomeEmail(user.email, user.name)
      sent++
    } catch (err) {
      failed++
      errors.push(`${user.email}: ${err instanceof Error ? err.message : String(err)}`)
      console.error('[welcome-drip] Failed to send to', user.email, err)
    }
  }

  // Log job run
  await prisma.jobRun.create({
    data: {
      job: 'welcome-drip',
      trigger: 'cron',
      finishedAt: new Date(),
      durationMs: Date.now() - start,
      success: failed === 0,
      result: { total: newUsers.length, sent, failed, errors: errors.slice(0, 10) }
    }
  })

  return NextResponse.json({
    ok: true,
    total: newUsers.length,
    sent,
    failed,
  })
}
