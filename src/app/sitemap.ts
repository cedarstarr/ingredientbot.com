import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

// Force dynamic so sitemap is generated at request time (not build time).
// Needed because it queries the DB for public recipe slugs.
export const dynamic = 'force-dynamic'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ingredientbot.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch public recipe slugs for dynamic recipe pages
  // NOTE: both take: 1000 caps below need raising (or splitting into sitemap
  // index files) as the recipe/ingredient libraries grow past them.
  const publicRecipes = await prisma.recipe.findMany({
    where: { isPublic: true, publicSlug: { not: null } },
    select: { publicSlug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 1000,
  })

  // Ingredient glossary pages — mirrors the public-recipe pattern above
  const ingredients = await prisma.ingredient.findMany({
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 1000,
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
    ...recipeEntries,
    ...ingredientEntries,
    ...allergenEntries,
  ]
}
