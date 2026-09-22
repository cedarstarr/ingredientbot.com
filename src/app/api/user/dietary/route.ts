import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// F79: medical dietary flags (low-sodium / low-FODMAP / diabetes-friendly) — persisted on DietaryProfile
const DIETARY_SELECT = {
  restrictions: true,
  cuisinePrefs: true,
  dislikedIngredients: true,
  lowSodium: true,
  lowFodmap: true,
  diabetesFriendly: true,
} as const

const EMPTY_PROFILE = {
  restrictions: [] as string[],
  cuisinePrefs: [] as string[],
  dislikedIngredients: [] as string[],
  lowSodium: false,
  lowFodmap: false,
  diabetesFriendly: false,
}

export async function GET() {
  const session = await auth()
  if (!session?.user) return new Response('Unauthorized', { status: 401 })

  try {
    const profile = await prisma.dietaryProfile.findUnique({
      where: { userId: session.user.id },
      select: DIETARY_SELECT,
    })
    return Response.json(profile ?? EMPTY_PROFILE)
  } catch {
    return Response.json({ error: 'Failed to fetch dietary profile' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json()

  try {
    // FOU-630: PATCH is the verb that invites partial payloads, but the old
    // code wrote `Array.isArray(...) ? ... : []` unconditionally — a caller
    // that omitted `restrictions` silently erased every stored allergy. Load
    // what's on file first so an absent field means "unchanged", not "user
    // has no allergies"; only a field actually present in the body overwrites
    // its stored value.
    const existing = await prisma.dietaryProfile.findUnique({
      where: { userId: session.user.id },
      select: DIETARY_SELECT,
    })

    const restrictions: string[] = Array.isArray(body.restrictions)
      ? body.restrictions
      : existing?.restrictions ?? []
    const cuisinePrefs: string[] = Array.isArray(body.cuisinePrefs)
      ? body.cuisinePrefs
      : existing?.cuisinePrefs ?? []
    const dislikedIngredients: string[] = Array.isArray(body.dislikedIngredients)
      ? body.dislikedIngredients
      : existing?.dislikedIngredients ?? []
    // F79: medical flags — only an explicit boolean in the body overrides the
    // stored value; an absent key (or a non-boolean) leaves it unchanged.
    const lowSodium = typeof body.lowSodium === 'boolean' ? body.lowSodium : existing?.lowSodium ?? false
    const lowFodmap = typeof body.lowFodmap === 'boolean' ? body.lowFodmap : existing?.lowFodmap ?? false
    const diabetesFriendly =
      typeof body.diabetesFriendly === 'boolean' ? body.diabetesFriendly : existing?.diabetesFriendly ?? false

    const profile = await prisma.dietaryProfile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        restrictions,
        cuisinePrefs,
        dislikedIngredients,
        lowSodium,
        lowFodmap,
        diabetesFriendly,
      },
      update: {
        restrictions,
        cuisinePrefs,
        dislikedIngredients,
        lowSodium,
        lowFodmap,
        diabetesFriendly,
      },
      select: DIETARY_SELECT,
    })
    return Response.json(profile)
  } catch {
    return Response.json({ error: 'Failed to save dietary profile' }, { status: 500 })
  }
}
