import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

// Force dynamic so sitemap is generated at request time (not build time).
// Needed because it queries the DB for public recipe slugs.
export const dynamic = 'force-dynamic'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ingredientbot.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch public recipe slugs for dynamic recipe pages.
  // Raised from 1000 on 2026-08-29: the library had reached 998 of that cap, so
  // the next content batch would have silently dropped recipes from the sitemap.
  // A single sitemap file is valid to 50,000 URLs — split into a sitemap index
  // only past that, not at this cap.
  const publicRecipes = await prisma.recipe.findMany({
    where: { isPublic: true, publicSlug: { not: null } },
    select: { publicSlug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 10000,
  })

  // Ingredient glossary pages — mirrors the public-recipe pattern above
  // Only rows with encyclopedia prose are real pages — see the published gate
  // in src/app/ingredients/[slug]/page.tsx. Search-only rows created by the
  // reverse-search backfill 404, so listing them here would advertise dead URLs.
  const ingredients = await prisma.ingredient.findMany({
    where: { description: { not: null } },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 10000,
  })

  // Cuisine listing pages. Each /recipes?cuisine=X view canonicalizes to itself
  // and is independently indexable, but nothing pointed crawlers at them beyond
  // in-page links. Derived from the data so a new cuisine needs no code change.
  const cuisineGroups = await prisma.recipe.groupBy({
    by: ['cuisine'],
    where: { isPublic: true, publicSlug: { not: null } },
    _max: { updatedAt: true },
  })

  // Allergen reference pages — published only; there are at most 15 rows
  // (one per ALLERGEN_VOCABULARY token) so no take cap is needed.
  const allergens = await prisma.allergen.findMany({
    where: { published: true },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  })

  const recipeEntries: MetadataRoute.Sitemap = publicRecipes
    .filter((r): r is typeof r & { publicSlug: string } => r.publicSlug !== null)
    .map((r) => ({
      url: `${baseUrl}/r/${r.publicSlug}`,
      lastModified: r.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

  // 'Other' is the label /recipes uses for the null-cuisine bucket, so the URL
  // must match what the page reads back out of the query string.
  const cuisineEntries: MetadataRoute.Sitemap = cuisineGroups.map((g) => ({
    url: `${baseUrl}/recipes?cuisine=${encodeURIComponent(g.cuisine ?? 'Other')}`,
    lastModified: g._max.updatedAt ?? new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  const ingredientEntries: MetadataRoute.Sitemap = ingredients.map((i) => ({
    url: `${baseUrl}/ingredients/${i.slug}`,
    lastModified: i.updatedAt,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }))

  const allergenEntries: MetadataRoute.Sitemap = allergens.map((a) => ({
    url: `${baseUrl}/allergens/${a.slug}`,
    lastModified: a.updatedAt,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }))

  return [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    // /kitchen is auth-gated — excluded to avoid crawl budget waste on redirect
    {
      url: `${baseUrl}/what-can-i-make`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/recipes`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/ingredients`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/allergens`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    ...cuisineEntries,
    ...recipeEntries,
    ...ingredientEntries,
    ...allergenEntries,
  ]
}
