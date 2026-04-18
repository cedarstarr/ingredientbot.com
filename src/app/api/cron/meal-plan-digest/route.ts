import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

export const maxDuration = 60

// F45: Weekly meal plan digest — sends a personalized email on Mondays
// listing the user's planned meals for the coming week.
export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()

  // Date range: next 7 days from today (UTC midnight)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const nextWeek = new Date(today)
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7)

  // Find meal plans with slots in the next 7-day window
  // MealPlan uses weekStart + dayOfWeek (0–6) rather than absolute dates,
  // so we fetch meal plans whose weekStart is within or just before the window.
  const windowStart = new Date(today)
  windowStart.setUTCDate(windowStart.getUTCDate() - 6) // include plans from last week that extend into this week

  const mealPlans = await prisma.mealPlan.findMany({
    where: {
      weekStart: { gte: windowStart, lte: nextWeek },
      user: { notifyProduct: true },
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
      slots: {
        include: {
          recipe: { select: { title: true, prepTimeMin: true, cookTimeMin: true } },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { mealType: 'asc' }],
      },
    },
  })

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const MEAL_ORDER = ['breakfast', 'lunch', 'dinner']

  // HTML-escape strings before interpolating into email template — user.name and
  // recipe.title are user-controlled, so raw interpolation risks self-XSS in
  // webmail clients that render HTML liberally.
  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const plan of mealPlans) {
    if (plan.slots.length === 0) continue

    try {
      // Group slots by day
      const byDay = new Map<number, typeof plan.slots>()
      for (const slot of plan.slots) {
        const arr = byDay.get(slot.dayOfWeek) ?? []
        arr.push(slot)
        byDay.set(slot.dayOfWeek, arr)
      }

      // Build plain-text meal list HTML
      const daysHtml = [...byDay.entries()]
        .sort(([a], [b]) => a - b)
        .map(([day, slots]) => {
          const sortedSlots = [...slots].sort(
            (a, b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType)
          )
          const mealsHtml = sortedSlots.map(s => {
            const time = (s.recipe.prepTimeMin ?? 0) + (s.recipe.cookTimeMin ?? 0)
            return `<tr><td style="padding:4px 12px 4px 0;color:#555;font-size:13px;text-transform:capitalize;">${escapeHtml(s.mealType)}</td><td style="padding:4px 0;font-size:14px;font-weight:600;color:#111;">${escapeHtml(s.recipe.title)}${time > 0 ? ` <span style="font-weight:normal;color:#888;">(${time}m)</span>` : ''}</td></tr>`
          }).join('')
          return `<div style="margin-bottom:16px;"><p style="font-weight:700;font-size:15px;margin:0 0 6px;color:#222;">${DAY_NAMES[day]}</p><table style="border-collapse:collapse;">${mealsHtml}</table></div>`
        }).join('')

      const displayName = escapeHtml(plan.user.name || 'there')
      const weekLabel = plan.weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
      const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ingredientbot.com'

      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
  <h2 style="color:#e57c2c;margin-bottom:4px;">Your Meal Plan for the Week of ${weekLabel}</h2>
  <p style="color:#555;margin-top:0;">Hey ${displayName}, here&apos;s what&apos;s on the menu!</p>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
  ${daysHtml}
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
  <p style="margin-top:16px;">
    <a href="${SITE_URL}/meal-plan" style="background:#e57c2c;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">View Meal Plan</a>
  </p>
  <p style="margin-top:32px;color:#999;font-size:12px;">
    You&apos;re receiving this because you have meal plan notifications enabled.
    <a href="${SITE_URL}/settings" style="color:#999;">Manage preferences</a>
  </p>
</body>
</html>`

      await sendEmail({ to: plan.user.email, subject: `Your meal plan for the week of ${weekLabel}`, html })
      sent++
    } catch (err) {
      failed++
      errors.push(`${plan.user.email}: ${err instanceof Error ? err.message : String(err)}`)
      console.error('[meal-plan-digest] Failed for', plan.user.email, err)
    }
  }

  await prisma.jobRun.create({
    data: {
      job: 'meal-plan-digest',
      trigger: 'cron',
      finishedAt: new Date(),
      durationMs: Date.now() - start,
      success: failed === 0,
      result: { total: mealPlans.length, sent, failed, errors: errors.slice(0, 10) },
    },
  })

  return NextResponse.json({ ok: true, total: mealPlans.length, sent, failed })
}
