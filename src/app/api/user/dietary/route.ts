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
  const restrictions: string[] = Array.isArray(body.restrictions) ? body.restrictions : []
  const cuisinePrefs: string[] = Array.isArray(body.cuisinePrefs) ? body.cuisinePrefs : []
  const dislikedIngredients: string[] = Array.isArray(body.dislikedIngredients) ? body.dislikedIngredients : []
  // F79: coerce medical flags to booleans — default false when absent
  const lowSodium = Boolean(body.lowSodium)
  const lowFodmap = Boolean(body.lowFodmap)
  const diabetesFriendly = Boolean(body.diabetesFriendly)

  try {
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
