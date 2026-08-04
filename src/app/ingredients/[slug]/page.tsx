import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChefHat, ArrowRight, ArrowLeft, Archive, CalendarDays, ShieldAlert, Replace } from 'lucide-react'
import { AllergenDisclaimer } from '@/components/allergen-disclaimer'
import { allergenLabel } from '@/lib/allergens'

export const revalidate = 3600

interface Props {
  params: Promise<{ slug: string }>
}

// cache() deduplicates the DB call between generateMetadata and the page render
const getIngredient = cache((slug: string) => prisma.ingredient.findUnique({ where: { slug } }))

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ingredientbot.com'

// Json column shapes — see prisma/schema.prisma Ingredient model comments
interface HiddenSource {
  product: string
  why: string
}

interface Substitution {
  reason: string
  substitute: string
  ratio?: string
  notes?: string
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const ingredient = await getIngredient(slug)

  if (!ingredient) return { title: 'Ingredient Not Found' }

  const description =
    ingredient.description ??
    `${ingredient.name}: storage, seasonality, allergen notes, and substitutions.`

  return {
    title: `${ingredient.name} — Ingredient Glossary — IngredientBot`,
    description,
    alternates: {
      canonical: `${baseUrl}/ingredients/${slug}`,
    },
    openGraph: {
      title: ingredient.name,
      description,
      siteName: 'IngredientBot',
    },
  }
}

export default async function IngredientDetailPage({ params }: Props) {
  const { slug } = await params
  const ingredient = await getIngredient(slug)

  if (!ingredient) notFound()

  const hiddenSources = (ingredient.hiddenSources as HiddenSource[] | null) ?? []
  const substitutions = (ingredient.substitutions as Substitution[] | null) ?? []

  const hasSafetyInfo =
    ingredient.allergenProfile.length > 0 ||
    hiddenSources.length > 0 ||
    ingredient.crossContamination != null

  return (
    <div className="min-h-screen bg-background">
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
          href="/ingredients"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Ingredient glossary
        </Link>

        {/* Title block */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 text-balance" data-testid="ingredient-detail-heading">
            {ingredient.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{ingredient.category}</Badge>
            {ingredient.allergenProfile.map((a) => (
              <Badge key={a} variant="secondary" className="bg-destructive/10 text-destructive hover:bg-destructive/10">
                {allergenLabel(a)}
              </Badge>
            ))}
          </div>
          {ingredient.description && (
            <p className="mt-4 text-muted-foreground text-lg leading-relaxed">{ingredient.description}</p>
          )}
        </div>

        {/* Storage & seasonality */}
        {(ingredient.storage || ingredient.seasonality) && (
          <div className="grid gap-4 sm:grid-cols-2 mb-8">
            {ingredient.storage && (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Archive className="h-4 w-4 text-primary" />
                  Storage
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{ingredient.storage}</p>
              </div>
            )}
            {ingredient.seasonality && (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Seasonality
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{ingredient.seasonality}</p>
              </div>
            )}
          </div>
        )}

        {/* Allergen profile, hidden sources, cross-contamination */}
        {hasSafetyInfo && (
          <section className="mb-4 rounded-lg border border-border bg-muted/30 p-4" data-testid="ingredient-allergen-info">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" />
              Allergen information
            </h2>
            {ingredient.allergenProfile.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Contains</p>
                <div className="flex flex-wrap gap-1.5">
                  {ingredient.allergenProfile.map((a) => (
                    <Badge key={a} variant="secondary" className="bg-destructive/10 text-destructive hover:bg-destructive/10">
                      {allergenLabel(a)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {hiddenSources.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  Products that often contain {ingredient.name.toLowerCase()}
                </p>
                <ul className="space-y-1.5">
                  {hiddenSources.map((s, i) => (
                    <li key={i} className="text-sm text-foreground">
                      <span className="font-medium">{s.product}</span>
                      {s.why && <span className="text-muted-foreground"> — {s.why}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ingredient.crossContamination && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Cross-contamination</p>
                <p className="text-sm text-foreground leading-relaxed">{ingredient.crossContamination}</p>
              </div>
            )}
          </section>
        )}

        {/* Safety notice sits between allergen info and substitutions — both are
            allergen-adjacent advice a reader might act on for a real allergy. */}
        <AllergenDisclaimer compact className="mb-8" />

        {/* Substitutions */}
        {substitutions.length > 0 && (
          <section className="mb-8" data-testid="ingredient-substitutions">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Replace className="h-4 w-4 text-primary" />
              Substitutions
            </h2>
            <ul className="space-y-3">
              {substitutions.map((s, i) => (
                <li key={i} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{s.substitute}</span>
                    {s.reason && <Badge variant="outline" className="text-xs">{s.reason}</Badge>}
                    {s.ratio && <span className="text-xs text-muted-foreground">Ratio: {s.ratio}</span>}
                  </div>
                  {s.notes && <p className="text-sm text-muted-foreground leading-relaxed">{s.notes}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* CTA */}
        <div className="mt-12 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
          <ChefHat className="h-8 w-8 text-primary mx-auto mb-3" />
          <h2 className="text-xl font-bold text-foreground mb-2">
            Got {ingredient.name.toLowerCase()} in the fridge?
          </h2>
          <p className="text-muted-foreground text-sm mb-4 max-w-sm mx-auto">
            Enter the ingredients you have and get AI-generated recipes instantly — free to try.
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
        <div className="flex items-center justify-center gap-4">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link href="/recipes" className="hover:text-foreground transition-colors">Recipes</Link>
          <Link href="/ingredients" className="hover:text-foreground transition-colors">Ingredients</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
        </div>
      </footer>
    </div>
  )
}
