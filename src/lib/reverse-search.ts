/**
 * "What can I make?" — deterministic reverse ingredient search.
 *
 * Every result contains ALL the ingredients the cook entered. Results are
 * ranked by how many EXTRA ingredients they still need, fewest first, then by
 * a popularity proxy within each tier.
 *
 * No AI at query time. AI is reserved for post-selection modifiers (make it
 * vegetarian, double the servings), which run against a recipe the cook has
 * already chosen.
 *
 * Ranking rests on `Recipe.nonStapleIngredientCount`, maintained by
 * scripts/backfill-recipe-ingredients.ts. Extras is that count minus however
 * many of the cook's ingredients the recipe matched — a per-row subtraction
 * rather than a GROUP BY over the join for every candidate.
 */
import { prisma } from '@/lib/prisma'
import { NON_VEGETARIAN_CATEGORIES, NON_VEGETARIAN_SLUGS, VEGETARIAN_EXCEPTIONS, NON_VEGETARIAN_RAW_PATTERNS } from '@/lib/ingredient-normalize'

export const MAX_INGREDIENTS = 20
export const DEFAULT_LIMIT = 24
export const MAX_LIMIT = 60

export interface SearchResult {
  id: string
  title: string
  publicSlug: string | null
  cuisine: string | null
  difficulty: string | null
  prepTimeMin: number | null
  cookTimeMin: number | null
  /** How many further ingredients this recipe needs. 0 = cookable right now. */
  extras: number
  totalIngredients: number
}

export interface SearchResponse {
  results: SearchResult[]
  hasMore: boolean
  /** Slugs that constrained the search, after staples were dropped. */
  matchedOn: string[]
  /** Requested slugs that are pantry staples — they never constrain a search. */
  ignoredStaples: string[]
  /** Requested slugs with no ingredient in the corpus. */
  unknown: string[]
}

/** Postgres LIKE metacharacters, escaped so user input cannot alter the pattern. */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export interface AutocompleteItem {
  slug: string
  name: string
  category: string
  isStaple: boolean
}

/**
 * Autocomplete over ingredient names AND aliases, so "EVOO" finds extra-virgin
 * olive oil. Deliberately includes rows with no encyclopedia prose: those are
 * hidden from the public glossary, but they are perfectly valid things to have
 * in your kitchen and must be searchable.
 */
export async function autocompleteIngredients(query: string, limit = 10): Promise<AutocompleteItem[]> {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []

  const escaped = escapeLike(q)
  const prefix = `${escaped}%`
  const contains = `%${escaped}%`

  // Ranked so a prefix hit on the real name beats a mid-word hit on an alias.
  // The corpus is a few hundred rows, so a sequential scan is the right plan.
  const rows = await prisma.$queryRaw<
    { slug: string; name: string; category: string; is_staple: boolean }[]
  >`
    SELECT slug, name, category, is_staple
    FROM ingredients
    WHERE lower(name) LIKE ${contains}
       OR EXISTS (SELECT 1 FROM unnest(aliases) a WHERE lower(a) LIKE ${contains})
    ORDER BY
      CASE
        WHEN lower(name) = ${q} THEN 0
        WHEN lower(name) LIKE ${prefix} THEN 1
        WHEN EXISTS (SELECT 1 FROM unnest(aliases) a WHERE lower(a) LIKE ${prefix}) THEN 2
        ELSE 3
      END,
      length(name),
      name
    LIMIT ${limit}
  `

  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    category: r.category,
    isStaple: r.is_staple,
  }))
}

/** Ingredient ids that make a recipe non-vegetarian, derived from the join. */
async function nonVegetarianIngredientIds(): Promise<string[]> {
  const rows = await prisma.ingredient.findMany({
    where: {
      OR: [
        { category: { in: [...NON_VEGETARIAN_CATEGORIES] } },
        { slug: { in: [...NON_VEGETARIAN_SLUGS] } },
      ],
      NOT: { slug: { in: [...VEGETARIAN_EXCEPTIONS] } },
    },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

export interface SearchOptions {
  /** Canonical ingredient slugs the cook has. */
  have: string[]
  vegetarianOnly?: boolean
  limit?: number
  offset?: number
}

export async function searchRecipesByIngredients(opts: SearchOptions): Promise<SearchResponse> {
  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
  const offset = Math.max(opts.offset ?? 0, 0)

  const requested = [...new Set(opts.have.map((s) => s.trim().toLowerCase()).filter(Boolean))].slice(
    0,
    MAX_INGREDIENTS,
  )

  const empty = (extra: Partial<SearchResponse> = {}): SearchResponse => ({
    results: [],
    hasMore: false,
    matchedOn: [],
    ignoredStaples: [],
    unknown: [],
    ...extra,
  })

  if (!requested.length) return empty()

  const known = await prisma.ingredient.findMany({
    where: { slug: { in: requested } },
    select: { id: true, slug: true, isStaple: true },
  })
  const knownBySlug = new Map(known.map((k) => [k.slug, k]))

  const unknown = requested.filter((s) => !knownBySlug.has(s))
  const ignoredStaples = known.filter((k) => k.isStaple).map((k) => k.slug)
  const required = known.filter((k) => !k.isStaple)

  // An ingredient nothing in the corpus knows about cannot be "present in every
  // result", so the honest answer is no results plus the reason — not a silent
  // drop that would return recipes lacking something the cook explicitly asked for.
  if (unknown.length) return empty({ ignoredStaples, unknown })

  // Staples never constrain: requiring "salt" would exclude every recipe that
  // simply does not bother to list it.
  if (!required.length) return empty({ ignoredStaples, unknown })

  const requiredIds = required.map((r) => r.id)
  const nonVegIds = opts.vegetarianOnly ? await nonVegetarianIngredientIds() : []
  // Word-boundary regex over every ingredient string, matched or not — see
  // NON_VEGETARIAN_RAW_PATTERNS for why the id check alone is not enough.
  // `\y` is Postgres's word boundary, so "ham" cannot fire inside "graham".
  const rawRegex = `\\y(${NON_VEGETARIAN_RAW_PATTERNS.join('|')})`

  // limit + 1 detects a further page without paying for a second COUNT.
  const rows = await prisma.$queryRaw<
    {
      id: string
      title: string
      public_slug: string | null
      cuisine: string | null
      difficulty: string | null
      prep_time_min: number | null
      cook_time_min: number | null
      non_staple_ingredient_count: number
      extras: number
    }[]
  >`
    WITH matched AS (
      SELECT ri.recipe_id, COUNT(DISTINCT ri.ingredient_id)::int AS matched_count
      FROM recipe_ingredients ri
      WHERE ri.ingredient_id = ANY(${requiredIds}::text[])
      GROUP BY ri.recipe_id
      HAVING COUNT(DISTINCT ri.ingredient_id) = ${requiredIds.length}
    )
    SELECT
      r.id, r.title, r.public_slug, r.cuisine, r.difficulty::text AS difficulty,
      r.prep_time_min, r.cook_time_min, r.non_staple_ingredient_count,
      GREATEST(r.non_staple_ingredient_count - m.matched_count, 0)::int AS extras
    FROM matched m
    JOIN recipes r ON r.id = m.recipe_id
    WHERE r.is_public = true
      AND (
        ${!opts.vegetarianOnly}::boolean
        OR (
          NOT EXISTS (
            SELECT 1 FROM recipe_ingredients x
            WHERE x.recipe_id = r.id AND x.ingredient_id = ANY(${nonVegIds}::text[])
          )
          AND NOT EXISTS (
            SELECT 1 FROM recipe_ingredients x
            WHERE x.recipe_id = r.id AND x.raw_name ~* ${rawRegex}
          )
        )
      )
    ORDER BY
      extras ASC,
      -- Popularity proxy until a real save/view counter exists: simpler and
      -- quicker recipes first. A recipe with no times recorded sorts last
      -- rather than pretending to be instant.
      r.non_staple_ingredient_count ASC,
      COALESCE(NULLIF(COALESCE(r.prep_time_min, 0) + COALESCE(r.cook_time_min, 0), 0), 2147483647) ASC,
      r.id ASC
    LIMIT ${limit + 1} OFFSET ${offset}
  `

  const hasMore = rows.length > limit
  return {
    results: rows.slice(0, limit).map((r) => ({
      id: r.id,
      title: r.title,
      publicSlug: r.public_slug,
      cuisine: r.cuisine,
      difficulty: r.difficulty,
      prepTimeMin: r.prep_time_min,
      cookTimeMin: r.cook_time_min,
      extras: Number(r.extras),
      totalIngredients: Number(r.non_staple_ingredient_count),
    })),
    hasMore,
    matchedOn: required.map((r) => r.slug),
    ignoredStaples,
    unknown,
  }
}
