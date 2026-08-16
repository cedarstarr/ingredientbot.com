import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChefHat, ArrowRight, ArrowLeft, ScrollText, Tags, ShieldAlert, Repeat, UtensilsCrossed } from 'lucide-react'
import { AllergenDisclaimer } from '@/components/allergen-disclaimer'
import { AllergyAwarenessNotice } from '@/components/allergy-awareness-notice'
import { safeJsonLdString } from '@/lib/utils'

export const revalidate = 3600

interface Props {
  params: Promise<{ slug: string }>
}

// cache() deduplicates the DB call between generateMetadata and the page render
const getAllergen = cache((slug: string) =>
  prisma.allergen.findUnique({ where: { slug } }),
)

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ingredientbot.com'

// Json column shapes — see prisma/schema.prisma Allergen model comments
interface HiddenSource {
  product: string
  why: string
}

interface RegulatoryStatus {
  fda9?: boolean
  eu14?: boolean
  notes?: string
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const allergen = await getAllergen(slug)

  if (!allergen || !allergen.published) return { title: 'Allergen Not Found' }

  const description = `${allergen.name}: regulatory status, alternate label names, hidden sources, and dining-out guidance.`

  return {
    title: `${allergen.name} — Allergen Reference — IngredientBot`,
    description,
    alternates: {
      canonical: `${baseUrl}/allergens/${slug}`,
    },
    openGraph: {
      title: `${allergen.name} allergen reference`,
      description,
      siteName: 'IngredientBot',
    },
  }
}

export default async function AllergenDetailPage({ params }: Props) {
  const { slug } = await params
  const allergen = await getAllergen(slug)

  // Unpublished rows 404 exactly like a missing row — a seeded-but-unreviewed
  // allergen page must never be reachable by guessing its slug.
  if (!allergen || !allergen.published) notFound()

  const status = (allergen.regulatoryStatus as RegulatoryStatus | null) ?? {}
  const hiddenSources = (allergen.hiddenSources as HiddenSource[] | null) ?? []

  // Cross-link into the ingredient glossary — the whole point of Link
  // targets matching Ingredient.allergenProfile is that this join works.
  const relatedIngredients = await prisma.ingredient.findMany({
    where: { allergenProfile: { has: slug } },
    select: { slug: true, name: true },
    orderBy: { name: 'asc' },
    take: 12,
  })

  const definedTermJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: allergen.name,
    description: allergen.diningOutGuidance || allergen.crossReactivity || allergen.name,
    inDefinedTermSet: `${baseUrl}/allergens`,
    url: `${baseUrl}/allergens/${slug}`,
  }

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdString(definedTermJsonLd) }}
      />

      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
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

      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link
          href="/allergens"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Allergen reference
        </Link>

        {/* Title block */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 text-balance" data-testid="allergen-detail-heading">
            {allergen.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {status.fda9 && <Badge variant="secondary">FDA Top 9</Badge>}
            {status.eu14 && <Badge variant="secondary">EU 14</Badge>}
          </div>
          {status.notes && (
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed" data-testid="allergen-regulatory-notes">
              {status.notes}
            </p>
          )}
        </div>

        <AllergenDisclaimer className="mb-8" />

        {/* Alternate label names */}
        {allergen.alternateNames.length > 0 && (
          <section className="mb-6 rounded-lg border border-border bg-muted/30 p-4" data-testid="allergen-alternate-names">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Tags className="h-4 w-4 text-primary" />
              Also appears on ingredient labels as
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {allergen.alternateNames.map((n) => (
                <Badge key={n} variant="outline" className="text-xs">
                  {n}
                </Badge>
              ))}
            </div>
          </section>
        )}

        {/* Hidden sources */}
        {hiddenSources.length > 0 && (
          <section className="mb-6 rounded-lg border border-border bg-muted/30 p-4" data-testid="allergen-hidden-sources">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" />
              Products that often contain {allergen.name.toLowerCase()}
            </h2>
            <ul className="space-y-1.5">
              {hiddenSources.map((s, i) => (
                <li key={i} className="text-sm text-foreground">
                  <span className="font-medium">{s.product}</span>
                  {s.why && <span className="text-muted-foreground"> — {s.why}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Cross-reactivity */}
        {allergen.crossReactivity && (
          <section className="mb-6 rounded-lg border border-border bg-muted/30 p-4" data-testid="allergen-cross-reactivity">
            <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Repeat className="h-4 w-4 text-primary" />
              Cross-reactivity
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{allergen.crossReactivity}</p>
          </section>
        )}

        {/* Dining out guidance */}
        {allergen.diningOutGuidance && (
          <section className="mb-6 rounded-lg border border-border bg-muted/30 p-4" data-testid="allergen-dining-out-guidance">
            <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-primary" />
              Eating out
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{allergen.diningOutGuidance}</p>
          </section>
        )}

        {/* Regulatory status detail */}
        <section className="mb-8 rounded-lg border border-border bg-muted/30 p-4" data-testid="allergen-regulatory-status">
          <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary" />
            Regulatory status
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {status.fda9 ? 'Recognized as one of the FDA "Big 9" major food allergens. ' : ''}
            {status.eu14 ? 'Listed among the EU 14 legally declarable allergens. ' : ''}
            {!status.fda9 && !status.eu14 ? 'Not on the FDA Big 9 or EU 14 lists tracked on this page. ' : ''}
            Always check the actual label of the product you buy — regulatory list membership
            describes disclosure requirements, not any specific product.
          </p>
        </section>

        {/* Cross-link into the ingredient glossary */}
        {relatedIngredients.length > 0 && (
          <section className="mb-12" data-testid="allergen-related-ingredients">
            <h2 className="text-lg font-semibold text-foreground mb-3">
              Ingredients flagged with {allergen.name.toLowerCase()}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {relatedIngredients.map((ing) => (
                <li key={ing.slug}>
                  <Link
                    href={`/ingredients/${ing.slug}`}
                    className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:border-primary/40 hover:bg-muted/30 transition-colors"
                  >
                    {ing.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* CTA */}
        <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
          <ChefHat className="h-8 w-8 text-primary mx-auto mb-3" />
          <h2 className="text-xl font-bold text-foreground mb-2">Cooking around {allergen.name.toLowerCase()}?</h2>
          <p className="text-muted-foreground text-sm mb-4 max-w-sm mx-auto">
            Set your dietary profile once and every recipe IngredientBot generates respects it —
            free to try.
          </p>
          <Button asChild size="lg">
            <Link href="/kitchen">
              Try IngredientBot Free
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        <AllergyAwarenessNotice className="mb-5 px-4" />
        <div className="flex items-center justify-center gap-4">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link href="/allergens" className="hover:text-foreground transition-colors">Allergens</Link>
          <Link href="/ingredients" className="hover:text-foreground transition-colors">Ingredients</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
        </div>
      </footer>
    </div>
  )
}
