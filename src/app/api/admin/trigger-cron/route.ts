import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

// Admin-only proxy that forwards to a cron route using the server-side CRON_SECRET.
// Replaces the previous client-side NEXT_PUBLIC_CRON_SECRET pattern, which would
// have leaked the cron secret into the public JS bundle.
const ALLOWED: Record<string, string> = {
  'welcome-drip': '/api/cron/welcome-drip',
  'meal-plan-digest': '/api/cron/meal-plan-digest',
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.isAdmin !== true) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const name = body?.name as string | undefined
  if (!name || !ALLOWED[name]) {
    return NextResponse.json({ error: 'Unknown cron' }, { status: 400 })
  }

  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }

  const origin = req.nextUrl.origin
  const target = `${origin}${ALLOWED[name]}`
  const res = await fetch(target, {
    method: 'GET',
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
  const text = await res.text()
  let data: unknown
  try { data = JSON.parse(text) } catch { data = text }
  return NextResponse.json({ ok: res.ok, status: res.status, data }, { status: res.ok ? 200 : 502 })
}
