import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChefHat, ArrowRight } from 'lucide-react'
import { IngredientIndexClient } from '@/components/ingredients/ingredient-index-client'

export const revalidate = 3600

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ingredientbot.com'

export const metadata: Metadata = {
  title: 'Ingredient Glossary — IngredientBot',
  description:
    'A reference guide to common cooking ingredients — storage tips, seasonality, allergen profiles, hidden sources, and substitutions.',
  alternates: {
    canonical: `${baseUrl}/ingredients`,
  },
}

export default async function IngredientsIndexPage() {
  // One query — the whole corpus is a few hundred rows, small enough to ship
  // to the client for instant search filtering without a search API.
  const ingredients = await prisma.ingredient.findMany({
    select: { slug: true, name: true, category: true, allergenProfile: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })

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

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground text-balance" data-testid="ingredients-index-heading">
            Ingredient glossary
          </h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Storage tips, seasonality, allergen profiles, and substitutions for the ingredients you
            cook with every day.
          </p>
        </div>

        <IngredientIndexClient ingredients={ingredients} />
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-4">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link href="/recipes" className="hover:text-foreground transition-colors">Recipes</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
        </div>
      </footer>
    </div>
  )
}
