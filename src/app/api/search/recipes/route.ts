import { NextRequest } from 'next/server'
import {
  searchRecipesByIngredients,
  DEFAULT_LIMIT,
  MAX_INGREDIENTS,
} from '@/lib/reverse-search'
import { clientIp, rateLimitResponse, searchLimiter } from '@/lib/rate-limit'

/**
 * Public reverse ingredient search.
 *
 * GET /api/search/recipes?have=chicken-thigh,garlic&filter=vegetarian&limit=24&offset=0
 *
 * Every result contains ALL the requested ingredients; `extras` on each result
 * is how many more it still needs, and the list is ordered fewest-extras-first
 * so the client can group it into tiers ("cook this now", "one more
 * ingredient", …). Deterministic SQL — no AI on this path.
 *
 * `filter=vegetarian` is derived from the ingredient join rather than the
 * recipe tag long tail. It only ever REMOVES results; nothing it returns is a
 * claim that a recipe is free from anything.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { success } = await searchLimiter.check(clientIp(req))
  if (!success) return rateLimitResponse()

  const params = req.nextUrl.searchParams
  const have = (params.get('have') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (!have.length) {
    return Response.json({ error: 'Pass at least one ingredient slug in ?have=' }, { status: 400 })
  }
  if (have.length > MAX_INGREDIENTS) {
    return Response.json(
      { error: `At most ${MAX_INGREDIENTS} ingredients per search.` },
      { status: 400 },
    )
  }

  const limitParam = Number(params.get('limit') ?? DEFAULT_LIMIT)
  const offsetParam = Number(params.get('offset') ?? 0)
  const filter = params.get('filter')

  try {
    const data = await searchRecipesByIngredients({
      have,
      vegetarianOnly: filter === 'vegetarian',
      limit: Number.isFinite(limitParam) ? limitParam : DEFAULT_LIMIT,
      offset: Number.isFinite(offsetParam) ? offsetParam : 0,
    })
    return Response.json(data)
  } catch (err) {
    console.error('[search/recipes] query failed', err)
    return Response.json({ error: 'Search unavailable' }, { status: 503 })
  }
}
