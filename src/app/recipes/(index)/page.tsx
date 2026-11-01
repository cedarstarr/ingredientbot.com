import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BrowseShell, RecipeCard, EmptyState } from '@/components/recipes/browse-shell'
import { OTHER_CUISINE_LABEL, slugifyCuisine } from '@/lib/recipe-format'

// FOU-466: `revalidate` used to live here, but it was dead — the filtered
// `?cuisine=` view was rendered inline via `searchParams`, which forces the
// whole page dynamic. That view now lives at its own segment, /recipes/[cuisine]
// (see that commit), but this page is STILL dynamic: src/app/layout.tsx reads
// headers()/cookies() unconditionally (EU consent gating + CSP nonce), which
// forces dynamic rendering app-wide regardless of any page-level `revalidate`.
// Removed rather than left in place implying a caching behavior that doesn't
// exist — see FOU-466 for the follow-up (root layout would need a conditional
// read, or Partial Prerendering, to let this page actually go static).
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ingredientbot.com'

export const metadata: Metadata = {
  title: 'Browse Recipes — IngredientBot',
  description:
    'Browse AI-generated recipes shared by IngredientBot users, organized by cuisine — full ingredients, steps, and nutrition estimates.',
  alternates: {
    canonical: `${baseUrl}/recipes`,
  },
}

const PER_SECTION = 6

export default async function RecipesBrowsePage() {
  const publicWhere = { isPublic: true as const, publicSlug: { not: null } }

  // Two fixed queries regardless of cuisine count (no N+1):
  // 1) groupBy for section headers + counts, 2) one capped findMany that is
  // bucketed per cuisine in JS, taking the newest PER_SECTION from each.
  const [cuisineGroups, recentRecipes] = await Promise.all([
    prisma.recipe.groupBy({
      by: ['cuisine'],
      where: publicWhere,
      _count: { _all: true },
    }),
    prisma.recipe.findMany({
      where: publicWhere,
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
      // Cap keeps the query bounded as the library grows; sections that lose
      // representation here still get a header + "View all" via groupBy.
      take: 600,
    }),
  ])

  const sections = cuisineGroups
    .map((g) => ({
      label: g.cuisine ?? OTHER_CUISINE_LABEL,
      count: g._count._all,
      recipes: recentRecipes
        .filter((r) => (r.cuisine ?? OTHER_CUISINE_LABEL) === (g.cuisine ?? OTHER_CUISINE_LABEL))
        .slice(0, PER_SECTION),
    }))
    .sort((a, b) => b.count - a.count)

  const total = sections.reduce((sum, s) => sum + s.count, 0)

  return (
    <BrowseShell>
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-foreground text-balance" data-testid="recipes-browse-heading">
          Browse recipes
        </h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          {total > 0
            ? `${total} AI-generated recipes shared by IngredientBot users, organized by cuisine.`
            : 'AI-generated recipes shared by IngredientBot users, organized by cuisine.'}
        </p>
      </div>

      {sections.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-12">
          {sections.map((section) => (
            <section key={section.label} data-testid={`recipes-cuisine-section-${section.label.toLowerCase().replace(/\s+/g, '-')}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground">{section.label}</h2>
                {section.count > section.recipes.length && (
                  <Link
                    href={`/recipes/${slugifyCuisine(section.label)}`}
                    className="text-sm text-primary hover:underline underline-offset-4 inline-flex items-center gap-1"
                    data-testid="recipes-cuisine-view-all"
                  >
                    View all {section.count}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.recipes.map((r) => (
                  <RecipeCard key={r.publicSlug} recipe={r} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </BrowseShell>
  )
}
