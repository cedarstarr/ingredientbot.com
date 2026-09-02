import { NextRequest } from 'next/server'
import { autocompleteIngredients } from '@/lib/reverse-search'
import { clientIp, rateLimitResponse, searchLimiter } from '@/lib/rate-limit'

/**
 * Public ingredient autocomplete for the "What can I make?" chip composer.
 *
 * GET /api/search/ingredients?q=oli
 *
 * Public by design — the whole point of reverse search is that a visitor can
 * use it before signing up. Requires a middleware PUBLIC_PATHS entry for
 * /api/search; without one this returns 401 to anonymous users.
 *
 * No `revalidate` here on purpose: a route handler that branches on
 * searchParams while declaring revalidate voids caching for every caller
 * (FOU-466), and these responses are per-query anyway.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { success } = await searchLimiter.check(clientIp(req))
  if (!success) return rateLimitResponse()

  const q = req.nextUrl.searchParams.get('q') ?? ''
  const limitParam = Number(req.nextUrl.searchParams.get('limit') ?? 10)
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 25) : 10

  // Under two characters every query matches most of the corpus, which is a
  // pointless round trip rather than a useful suggestion list.
  if (q.trim().length < 2) return Response.json({ results: [] })

  try {
    const results = await autocompleteIngredients(q, limit)
    return Response.json({ results })
  } catch (err) {
    console.error('[search/ingredients] query failed', err)
    return Response.json({ error: 'Search unavailable' }, { status: 503 })
  }
}
