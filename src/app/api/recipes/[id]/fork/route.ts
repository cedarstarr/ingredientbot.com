import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formLimiter } from '@/lib/rate-limit'
import { startOfCurrentMonth } from '@/lib/date-utils'

/**
 * Copy a PUBLIC library recipe into the signed-in user's own collection, so the
 * AI modifier stack can run on it.
 *
 * Every modifier route (`/modify`, `/convert-diet`, `/save-variant`) scopes its
 * lookup with `findFirst({ id, userId })`, and the 998 library recipes belong to
 * the house account — so "make this vegetarian" on a library recipe is a 404
 * until the user owns a copy. This is that copy.
 *
 * Deliberately NO AI: it is a byte-for-byte duplicate of an already-generated
 * recipe. Spending a model call to reproduce text we already have would be
 * slower, less reliable, and would burn shared broker budget for nothing.
 *
 * FREE_TIER_LIMIT mirrors /cook and /save-variant — a fork creates a Recipe row
 * exactly like they do, so leaving it unmetered would be an open bypass of the
 * monthly cap.
 */
const FREE_TIER_LIMIT = 5

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    // 401 rather than a redirect: the caller is the client button on the cached
    // public recipe page, which sends the visitor to /login itself.
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
    const { success } = await formLimiter.check(ip)
    if (!success) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })

    const { id } = await params

    // isPublic is the authorisation check. NOT owner-scoped, unlike every other
    // route under this path — that is the entire point — so the public flag is
    // the only thing standing between a visitor and someone's private recipe.
    const source = await prisma.recipe.findFirst({
      where: { id, isPublic: true },
      select: {
        id: true, title: true, description: true, servings: true,
        prepTimeMin: true, cookTimeMin: true, cuisine: true, difficulty: true,
        sourceIngredients: true, recipeData: true, rawText: true, nutrition: true,
        tags: true, allergens: true, mayContain: true, allergenNotes: true,
        allergenAnnotatedAt: true,
      },
    })
    if (!source) return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })

    // Already forked? Hand back the existing copy instead of making a second one.
    // Forking is metered, so a double click — or simply revisiting the page and
    // pressing Cook this again — would otherwise spend two of five on one dish.
    const existing = await prisma.recipe.findFirst({
      where: { userId: session.user.id, forkedFromId: source.id },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    })
    if (existing) return NextResponse.json({ id: existing.id, existing: true })

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isPro: true, recipeCount: true, monthlyResetDate: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const monthStart = startOfCurrentMonth()
    const needsReset = !user.monthlyResetDate || user.monthlyResetDate < monthStart
    if (!user.isPro) {
      const currentCount = needsReset ? 0 : user.recipeCount
      if (currentCount >= FREE_TIER_LIMIT) {
        return NextResponse.json({ error: 'limit_reached', limit: FREE_TIER_LIMIT }, { status: 402 })
      }
    }

    const [recipe] = await prisma.$transaction([
      prisma.recipe.create({
        data: {
          userId: session.user.id,
          title: source.title,
          description: source.description,
          servings: source.servings,
          prepTimeMin: source.prepTimeMin,
          cookTimeMin: source.cookTimeMin,
          cuisine: source.cuisine,
          difficulty: source.difficulty,
          sourceIngredients: source.sourceIngredients,
          recipeData: source.recipeData as object,
          rawText: source.rawText,
          nutrition: (source.nutrition as object) ?? undefined,
          tags: source.tags,
          // Allergen annotations are carried over rather than recomputed. They
          // came from the paid frontier lane on the library row; regenerating
          // them on a free lane is exactly the silent downgrade that lane rule
          // exists to prevent, and dropping them would render the copy with no
          // allergen information at all.
          allergens: source.allergens,
          mayContain: source.mayContain,
          allergenNotes: source.allergenNotes,
          allergenAnnotatedAt: source.allergenAnnotatedAt,
          forkedFromId: source.id,
          // The copy is the user's own, never public: publicSlug is unique, and
          // isPublic defaults false.
        },
        select: { id: true },
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: {
          recipeCount: needsReset ? 1 : { increment: 1 },
          monthlyResetDate: needsReset ? monthStart : undefined,
        },
      }),
    ])

    return NextResponse.json({ id: recipe.id, existing: false })
  } catch (err) {
    console.error('[recipes/fork] failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
