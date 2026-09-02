import type { Metadata } from 'next'
import Link from 'next/link'
import { ChefHat, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReverseSearchClient } from './search-client'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ingredientbot.com'

export const metadata: Metadata = {
  title: 'What Can I Make? — Recipe Search by Ingredient | IngredientBot',
  description:
    'Tell us what is in your kitchen and we will show you what you can cook, starting with the recipes that need nothing else. Search 998 recipes across 50 cuisines.',
  alternates: { canonical: `${baseUrl}/what-can-i-make` },
}

/**
 * The reverse ingredient search surface.
 *
 * Deliberately a STATIC shell around a client island. The search state lives in
 * React, not in searchParams: a route that branches on searchParams renders
 * dynamically for every caller (FOU-466), and reading them on the client adds a
 * hydration bail-out of exactly the kind implicated in the WebKit input bug
 * (FOU-413). The cost is that a search is not yet shareable as a URL.
 */
export default function WhatCanIMakePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-foreground transition-colors hover:text-primary"
          >
            <ChefHat className="h-5 w-5 text-primary" />
            IngredientBot
          </Link>
          <Button asChild size="sm">
            <Link href="/signup">
              Get started
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8">
          <h1
            className="text-balance text-3xl font-bold text-foreground sm:text-4xl"
            data-testid="what-can-i-make-heading"
          >
            What can I make?
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Add what you have. We rank every recipe by how little else you need — the ones at the
            top you can cook right now.
          </p>
        </div>

        <ReverseSearchClient />
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-4">
          <Link href="/" className="transition-colors hover:text-foreground">Home</Link>
          <Link href="/recipes" className="transition-colors hover:text-foreground">Recipes</Link>
          <Link href="/ingredients" className="transition-colors hover:text-foreground">Ingredients</Link>
          <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
        </div>
      </footer>
    </div>
  )
}
