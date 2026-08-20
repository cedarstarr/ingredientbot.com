import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPalateProfile } from '@/lib/palate'

// F87: read-only settings view of the derived palate profile, plus a Reset
// action. There is no PATCH here — the profile is never user-entered, only
// computed from behaviour by getPalateProfile() (also called lazily from the
// generate/cook routes on >24h staleness).

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Reuse the same lazy-recompute path the recipe routes use, so a user who
    // already has rating/completion history sees a populated card immediately
    // rather than waiting for their next recipe generation.
    const profile = await getPalateProfile(session.user.id)
    return NextResponse.json(
      profile ?? { lovedFlavors: [], avoidedIngredients: [], topCuisines: [], computedAt: null },
    )
  } catch {
    return NextResponse.json({ error: 'Failed to load palate profile' }, { status: 500 })
  }
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Idempotent — deleteMany rather than delete so re-resetting an already-empty
    // profile is a no-op, not a 500. The next generate/cook call (or GET here)
    // recomputes from scratch since the row is gone.
    await prisma.palateProfile.deleteMany({ where: { userId: session.user.id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to reset palate profile' }, { status: 500 })
  }
}
