import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWelcomeEmail } from '@/lib/email'
import { childLogger } from '@/lib/logger'

export const maxDuration = 60

// A hard-bouncing or permanently-misconfigured address stops being retried after this
// many attempts, rather than being retried forever by an unbounded record-based query.
const MAX_WELCOME_ATTEMPTS = 3

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
    // The record decides who still needs the email, not the clock: welcomeEmailSentAt
    // null + attempts under the cap is the whole eligibility condition, so a failed send
    // (or an overlapping run) naturally retries the same user next time instead of a
    // lookback window sliding past them or double-sending on the overlap. createdAt is
    // only a sanity bound here — generous relative to the daily cadence — to keep this a
    // "new signup" job and keep the query cheap; it is not what prevents re-sends.
    const newUserWindow = new Date(Date.now() - 7 * 24 * 3600 * 1000)
    const newUsers = await prisma.user.findMany({
      where: {
        createdAt: { gte: newUserWindow },
        notifyMarketing: true,
        emailVerified: { not: null },
        welcomeEmailSentAt: null,
        welcomeEmailAttempts: { lt: MAX_WELCOME_ATTEMPTS },
      },
      select: { id: true, email: true, name: true }
    })

    const results = await Promise.allSettled(
      newUsers.map(user => sendWelcomeEmail(user.email, user.name))
    )

    let sent = 0
    let failed = 0
    const errors: string[] = []
    const sentIds: string[] = []
    const failedIds: string[] = []

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        sent++
        sentIds.push(newUsers[i].id)
      } else {
        failed++
        failedIds.push(newUsers[i].id)
        const err = result.reason
        errors.push(`${newUsers[i].email}: ${err instanceof Error ? err.message : String(err)}`)
        log.error({ err, email: newUsers[i].email }, '[welcome-drip] Failed to send')
      }
    })

    // Persist the outcome per user so the next run's selection query reflects reality —
    // this is what actually stops the double-send/lost-send shape, not the try/catch above.
    if (sentIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: sentIds } },
        data: { welcomeEmailSentAt: new Date(), welcomeEmailAttempts: { increment: 1 } },
      })
    }
    if (failedIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: failedIds } },
        data: { welcomeEmailAttempts: { increment: 1 } },
      })
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
