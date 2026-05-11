import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWelcomeEmail } from '@/lib/email'
import { childLogger } from '@/lib/logger'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Fail closed: if CRON_SECRET is unset, reject all callers. Previously this fell open
  // and allowed unauthenticated callers to trigger bulk email sends.
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })
  }
  const cronSecret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID()
  const log = childLogger(requestId)

  const start = Date.now()

  try {
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

    const results = await Promise.allSettled(
      newUsers.map(user => sendWelcomeEmail(user.email, user.name))
    )

    let sent = 0
    let failed = 0
    const errors: string[] = []

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        sent++
      } else {
        failed++
        const err = result.reason
        errors.push(`${newUsers[i].email}: ${err instanceof Error ? err.message : String(err)}`)
        log.error({ err, email: newUsers[i].email }, '[welcome-drip] Failed to send')
      }
    })

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
  } catch (err) {
    // DB connection drop or unexpected throw — record the failed run if we can,
    // then surface a 500 so Vercel cron logs flag the failure rather than silently 200.
    log.error({ err }, '[welcome-drip] Unhandled job failure')
    await prisma.jobRun.create({
      data: {
        job: 'welcome-drip',
        trigger: 'cron',
        finishedAt: new Date(),
        durationMs: Date.now() - start,
        success: false,
        result: { error: err instanceof Error ? err.message : String(err) },
      },
    }).catch(() => { /* swallow — DB itself may be the failure */ })
    return NextResponse.json({ error: 'Job failed' }, { status: 500 })
  }
}
