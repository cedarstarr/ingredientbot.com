import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BrowseShell, RecipeCard, EmptyState } from '@/components/recipes/browse-shell'
import { OTHER_CUISINE_LABEL, slugifyCuisine } from '@/lib/recipe-format'

// FOU-466: split out of /recipes so the overview there can drop searchParams
// and actually revalidate. This segment owns the filtered, indexable view —
// one clean URL per cuisine instead of /recipes?cuisine=X.
export const revalidate = 3600

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ingredientbot.com'
const publicWhere = { isPublic: true as const, publicSlug: { not: null } }

interface Props {
  params: Promise<{ cuisine: string }>
}

/**
 * `cuisine` is free-text from the AI seeder, not an enum, so a URL slug can't
 * be reversed back to the exact stored string (casing, punctuation) by formula.
 * Resolve it against the actual distinct values instead — a small, cheap query
 * (a handful of cuisines exist today) that also doubles as the unknown-slug
 * gate for notFound(). `cache()` dedupes this between generateMetadata and the
 * page render, same pattern as /allergens/[slug] and /ingredients/[slug].
 */
const resolveCuisine = cache(async (slug: string): Promise<{ label: string; dbValue: string | null } | null> => {
  const groups = await prisma.recipe.groupBy({
    by: ['cuisine'],
    where: publicWhere,
    _count: { _all: true },
  })

  for (const g of groups) {
    const label = g.cuisine ?? OTHER_CUISINE_LABEL
    if (slugifyCuisine(label) === slug) {
      return { label, dbValue: g.cuisine }
    }
  }
  return null
})

export async function generateStaticParams(): Promise<{ cuisine: string }[]> {
  const groups = await prisma.recipe.groupBy({
    by: ['cuisine'],
    where: publicWhere,
    _count: { _all: true },
  })

  const slugs = new Set(groups.map((g) => slugifyCuisine(g.cuisine ?? OTHER_CUISINE_LABEL)))
  return Array.from(slugs).map((cuisine) => ({ cuisine }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cuisine: slug } = await params
  const resolved = await resolveCuisine(slug)

  if (!resolved) return { title: 'Cuisine Not Found — IngredientBot' }

  const description = `AI-generated ${resolved.label} recipes shared by IngredientBot users — full ingredients, steps, and nutrition estimates.`

  return {
    title: `${resolved.label} Recipes — IngredientBot`,
    description,
    alternates: {
      canonical: `${baseUrl}/recipes/${slug}`,
    },
  }
}

export default async function RecipesCuisinePage({ params }: Props) {
  const { cuisine: slug } = await params
  const resolved = await resolveCuisine(slug)

  // Unknown cuisine slug 404s for real rather than rendering an empty page —
  // a stale/guessed slug is not the same thing as a cuisine with zero recipes
  // (which is a legitimate empty state, handled by EmptyState below).
  if (!resolved) notFound()

  // chose a 120 cap over offset pagination because no cuisine is near that
  // size today; revisit with cursor pagination if a cuisine outgrows it.
  const recipes = await prisma.recipe.findMany({
    where: {
      ...publicWhere,
      cuisine: resolved.dbValue,
    },
    select: {
      publicSlug: true,
      title: true,
      description: true,
      cuisine: true,
      difficulty: true,
      prepTimeMin: true,
      cookTimeMin: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 120,
  })

  return (
    <BrowseShell>
      <div className="mb-8">
        <Link
          href="/recipes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All cuisines
        </Link>
        <h1 className="text-3xl font-bold text-foreground text-balance" data-testid="recipes-browse-heading">
          {resolved.label} recipes
        </h1>
        <p className="mt-2 text-muted-foreground">
          {recipes.length} AI-generated {recipes.length === 1 ? 'recipe' : 'recipes'} shared by IngredientBot users.
        </p>
      </div>
      {recipes.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r) => (
            <RecipeCard key={r.publicSlug} recipe={r} />
          ))}
        </div>
      )}
    </BrowseShell>
  )
}
