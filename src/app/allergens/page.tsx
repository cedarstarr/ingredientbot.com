import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChefHat, ArrowRight, ShieldAlert } from 'lucide-react'
import { AllergenDisclaimer } from '@/components/allergen-disclaimer'
import { AllergyAwarenessNotice } from '@/components/allergy-awareness-notice'
import { safeJsonLdString } from '@/lib/utils'

export const revalidate = 3600

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ingredientbot.com'

export const metadata: Metadata = {
  title: 'Allergen Reference — IngredientBot',
  description:
    'A reference guide to the major food allergens — regulatory status, alternate label names, hidden sources, cross-reactivity, and dining-out guidance.',
  alternates: {
    canonical: `${baseUrl}/allergens`,
  },
}

interface RegulatoryStatus {
  fda9?: boolean
  eu14?: boolean
  notes?: string
}

export default async function AllergensIndexPage() {
  // Only 15 canonical rows ever exist (one per ALLERGEN_VOCABULARY token), so
  // a single unfiltered query is fine — no pagination, no client search.
  const allergens = await prisma.allergen.findMany({
    where: { published: true },
    select: { slug: true, name: true, regulatoryStatus: true },
    orderBy: { name: 'asc' },
  })

  const definedTermSetJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: 'IngredientBot Allergen Reference',
    description: metadata.description,
    url: `${baseUrl}/allergens`,
    hasDefinedTerm: allergens.map((a) => ({
      '@type': 'DefinedTerm',
      name: a.name,
      url: `${baseUrl}/allergens/${a.slug}`,
    })),
  }

  return (
    <div className="min-h-screen bg-background">
      {allergens.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdString(definedTermSetJsonLd) }}
        />
      )}

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
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground text-balance" data-testid="allergens-index-heading">
            Allergen reference
          </h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Regulatory status, alternate label names, commonly hidden sources, cross-reactivity, and
            practical dining-out guidance for the major food allergens.
          </p>
        </div>

        <AllergenDisclaimer className="mb-8" />

        {allergens.length === 0 ? (
          <div
            data-testid="allergens-empty-state"
            className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground"
          >
            <ShieldAlert className="h-8 w-8 mx-auto mb-3 text-muted-foreground/60" />
            <p>No allergen reference pages are published yet.</p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {allergens.map((a) => {
              const status = (a.regulatoryStatus as RegulatoryStatus | null) ?? {}
              return (
                <li key={a.slug}>
                  <Link
                    href={`/allergens/${a.slug}`}
                    data-testid="allergens-index-card"
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:bg-muted/30 transition-colors"
                  >
                    <span className="font-medium text-foreground">{a.name}</span>
                    <span className="flex flex-wrap gap-1.5 justify-end">
                      {status.fda9 && (
                        <Badge variant="secondary" className="text-xs">
                          FDA 9
                        </Badge>
                      )}
                      {status.eu14 && (
                        <Badge variant="secondary" className="text-xs">
                          EU 14
                        </Badge>
                      )}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        <AllergyAwarenessNotice className="mb-5 px-4" />
        <div className="flex items-center justify-center gap-4">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link href="/ingredients" className="hover:text-foreground transition-colors">Ingredients</Link>
          <Link href="/recipes" className="hover:text-foreground transition-colors">Recipes</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
        </div>
      </footer>
    </div>
  )
}
