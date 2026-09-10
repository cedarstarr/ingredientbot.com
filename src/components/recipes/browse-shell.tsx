/**
 * Shared chrome + card for the public recipe browse surfaces (/recipes and
 * /recipes/[cuisine]) so the two views never drift, mirroring the split
 * already used for /ingredients and /allergens.
 */
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChefHat, ArrowRight, Clock, UtensilsCrossed } from 'lucide-react'
import { AllergyAwarenessNotice } from '@/components/allergy-awareness-notice'
import { CopyrightNotice } from '@/components/copyright-notice'
import { formatDuration } from '@/lib/recipe-format'

export interface RecipeCardData {
  publicSlug: string | null
  title: string
  description: string | null
  cuisine: string | null
  difficulty: string | null
  prepTimeMin: number | null
  cookTimeMin: number | null
}

export function RecipeCard({ recipe }: { recipe: RecipeCardData }) {
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

export function EmptyState() {
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
export function BrowseShell({ children }: { children: React.ReactNode }) {
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
        <CopyrightNotice className="mt-3" />
      </footer>
    </div>
  )
}
