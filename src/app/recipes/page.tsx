import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChefHat, ArrowRight, ArrowLeft, Clock, UtensilsCrossed } from 'lucide-react'
import { AllergyAwarenessNotice } from '@/components/allergy-awareness-notice'
import { formatDuration } from '@/lib/recipe-format'

export const revalidate = 3600

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ingredientbot.com'

interface Props {
  searchParams: Promise<{ cuisine?: string }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { cuisine } = await searchParams
  const title = cuisine
    ? `${cuisine} Recipes — IngredientBot`
    : 'Browse Recipes — IngredientBot'
  const description = cuisine
    ? `AI-generated ${cuisine} recipes shared by IngredientBot users — full ingredients, steps, and nutrition estimates.`
    : 'Browse AI-generated recipes shared by IngredientBot users, organized by cuisine — full ingredients, steps, and nutrition estimates.'
  return {
    title,
    description,
    alternates: {
      // Canonical stays /recipes for the unfiltered view; cuisine views canonicalize
      // to themselves so each cuisine listing is independently indexable.
      canonical: cuisine ? `${baseUrl}/recipes?cuisine=${encodeURIComponent(cuisine)}` : `${baseUrl}/recipes`,
    },
  }
}

interface RecipeCardData {
  publicSlug: string | null
  title: string
  description: string | null
  cuisine: string | null
  difficulty: string | null
  prepTimeMin: number | null
  cookTimeMin: number | null
}

function RecipeCard({ recipe }: { recipe: RecipeCardData }) {
  const totalMin = (recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0)
  return (
    <Link
      href={`/r/${recipe.publicSlug}`}
      className="group flex flex-col rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid="recipes-browse-card"
    >
      <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 text-balance">
        {recipe.title}
      </h3>
      {recipe.description && (
        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{recipe.description}</p>
      )}
      <div className="mt-auto pt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {recipe.cuisine && <Badge variant="secondary" className="text-xs">{recipe.cuisine}</Badge>}
        {recipe.difficulty && <Badge variant="outline" className="text-xs">{recipe.difficulty}</Badge>}
        {totalMin > 0 && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(totalMin)}
          </span>
        )}
      </div>
    </Link>
  )
}

const OTHER_LABEL = 'Other'
const PER_SECTION = 6

export default async function RecipesBrowsePage({ searchParams }: Props) {
  const { cuisine } = await searchParams

  const publicWhere = { isPublic: true as const, publicSlug: { not: null } }

  if (cuisine) {
    // Filtered view — all public recipes of one cuisine, one query.
    // chose a 120 cap over offset pagination because no cuisine is near that
    // size today; revisit with cursor pagination if a cuisine outgrows it.
    const recipes = await prisma.recipe.findMany({
      where: {
        ...publicWhere,
        ...(cuisine === OTHER_LABEL ? { cuisine: null } : { cuisine }),
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
            {cuisine} recipes
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

  // Overview — two fixed queries regardless of cuisine count (no N+1):
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
      label: g.cuisine ?? OTHER_LABEL,
      count: g._count._all,
      recipes: recentRecipes
        .filter((r) => (r.cuisine ?? OTHER_LABEL) === (g.cuisine ?? OTHER_LABEL))
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
                    href={`/recipes?cuisine=${encodeURIComponent(section.label)}`}
                    className="text-sm text-primary hover:underline underline-offset-4 inline-flex items-center gap-1"
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

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border py-16 text-center" data-testid="recipes-empty-state">
      <UtensilsCrossed className="h-10 w-10 text-muted-foreground/50 mx-auto mb-4" />
      <h2 className="text-lg font-semibold text-foreground mb-2">No shared recipes yet</h2>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
        Recipes appear here when IngredientBot users share them publicly. Generate your own from
        whatever is in your fridge — it takes seconds.
      </p>
      <Button asChild>
        <Link href="/kitchen">
          Try IngredientBot Free
          <ArrowRight className="h-4 w-4 ml-2" />
        </Link>
      </Button>
    </div>
  )
}

// Shared public-page chrome, mirroring /r/[slug]'s minimal no-auth header/footer
function BrowseShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors">
            <ChefHat className="h-5 w-5 text-primary" />
            IngredientBot
          </Link>
          <Button asChild size="sm">
            <Link href="/kitchen">
              Try it free
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">{children}</main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        <AllergyAwarenessNotice className="mb-5 px-4" />
        <div className="flex items-center justify-center gap-4">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link href="/ingredients" className="hover:text-foreground transition-colors">Ingredients</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
        </div>
      </footer>
    </div>
  )
}
