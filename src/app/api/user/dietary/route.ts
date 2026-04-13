import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user) return new Response('Unauthorized', { status: 401 })

  const profile = await prisma.dietaryProfile.findUnique({
    where: { userId: session.user.id },
    select: { restrictions: true, cuisinePrefs: true, dislikedIngredients: true },
  })

  // Return empty arrays if no profile exists yet
  return Response.json(
    profile ?? { restrictions: [], cuisinePrefs: [], dislikedIngredients: [] }
  )
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json()
  const restrictions: string[] = Array.isArray(body.restrictions) ? body.restrictions : []
  const cuisinePrefs: string[] = Array.isArray(body.cuisinePrefs) ? body.cuisinePrefs : []
  const dislikedIngredients: string[] = Array.isArray(body.dislikedIngredients) ? body.dislikedIngredients : []

  // upsert — create on first save, update thereafter
  const profile = await prisma.dietaryProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, restrictions, cuisinePrefs, dislikedIngredients },
    update: { restrictions, cuisinePrefs, dislikedIngredients },
    select: { restrictions: true, cuisinePrefs: true, dislikedIngredients: true },
  })

  return Response.json(profile)
}
