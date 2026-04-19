import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

// Force dynamic so sitemap is generated at request time (not build time).
// Needed because it queries the DB for public recipe slugs.
export const dynamic = 'force-dynamic'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ingredientbot.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch public recipe slugs for dynamic recipe pages
  const publicRecipes = await prisma.recipe.findMany({
    where: { isPublic: true, publicSlug: { not: null } },
    select: { publicSlug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 1000,
  })

  const recipeEntries: MetadataRoute.Sitemap = publicRecipes
    .filter((r): r is typeof r & { publicSlug: string } => r.publicSlug !== null)
    .map((r) => ({
      url: `${baseUrl}/r/${r.publicSlug}`,
      lastModified: r.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
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
  ]
}
