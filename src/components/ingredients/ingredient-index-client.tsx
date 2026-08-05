'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { allergenLabel } from '@/lib/allergens'
import { Search, Leaf } from 'lucide-react'

export interface GlossaryIngredient {
  slug: string
  name: string
  category: string
  allergenProfile: string[]
}

export function IngredientIndexClient({ ingredients }: { ingredients: GlossaryIngredient[] }) {
  const [query, setQuery] = useState('')

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? ingredients.filter(
          (i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
        )
      : ingredients
    const byCategory = new Map<string, GlossaryIngredient[]>()
    for (const ing of filtered) {
      const list = byCategory.get(ing.category) ?? []
      list.push(ing)
      byCategory.set(ing.category, list)
    }
    return Array.from(byCategory.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [ingredients, query])

  return (
    <div>
      <div className="relative max-w-md mb-10">
        <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ingredients…"
          aria-label="Search ingredients"
          className="pl-9"
          data-testid="ingredients-search-input"
        />
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center" data-testid="ingredients-empty-state">
          <Leaf className="h-10 w-10 text-muted-foreground/50 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            {ingredients.length === 0 ? 'The glossary is still being stocked' : 'No ingredients match'}
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {ingredients.length === 0
              ? 'Ingredient reference pages — storage, seasonality, allergen notes, and substitutions — are on their way.'
              : 'Try a different search term or browse the full list.'}
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {grouped.map(([category, items]) => (
            <section key={category} data-testid={`ingredients-category-${category.toLowerCase().replace(/\s+/g, '-')}`}>
              <h2 className="text-xl font-semibold text-foreground mb-4">{category}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((ing) => (
                  <Link
                    key={ing.slug}
                    href={`/ingredients/${ing.slug}`}
                    className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="ingredients-index-card"
                  >
                    <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {ing.name}
                    </span>
                    {ing.allergenProfile.length > 0 && (
                      <span className="flex flex-wrap gap-1 justify-end">
                        {ing.allergenProfile.slice(0, 2).map((a) => (
                          <Badge key={a} variant="secondary" className="text-[10px] bg-destructive/10 text-destructive hover:bg-destructive/10">
                            {allergenLabel(a)}
                          </Badge>
                        ))}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
