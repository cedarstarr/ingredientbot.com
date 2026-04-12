'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { ModificationToolbar } from './modification-toolbar'
import { GroceryListSheet } from './grocery-list-sheet'
import { SubstitutionPanel } from './substitution-panel'
import { CookedThisButton } from './cooked-this-button'
import { RecipeTags } from './recipe-tags'
import { CollectionPicker } from './collection-picker'
import { RecipeRating } from './recipe-rating'
import { Clock, Users, ChevronLeft, Loader2, BookOpen, HelpCircle, Printer, Sparkles, UtensilsCrossed } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Ingredient {
  name: string
  amount: string
  unit: string
}

interface RecipeData {
  title: string
  description?: string
  servings?: number
  prepTimeMin?: number
  cookTimeMin?: number
  cuisine?: string
  difficulty?: string
  ingredients: Ingredient[]
  steps: string[]
  notes?: string
  nutrition?: {
    calories: number
    protein: number
    fat: number
    carbs: number
    fiber: number
  }
}

interface Collection {
  id: string
  name: string
  color: string
}

interface Recipe {
  id: string
  title: string
  description?: string | null
  servings: number
  prepTimeMin?: number | null
  cookTimeMin?: number | null
  cuisine?: string | null
  difficulty?: string | null
  recipeData: unknown
  rawText: string
  nutrition?: unknown
  tags?: string[]
  cookedCount?: number
  lastCookedAt?: Date | string | null
  collectionId?: string | null
  collection?: Collection | null
  rating?: number | null
}

interface Props {
  recipe: Recipe
  collections?: Collection[]
}

// F33: parse a numeric quantity from an amount string like "1/2", "1.5", "2"
function parseQuantity(amount: string): number | null {
  const trimmed = amount.trim()
  // Handle fractions like "1/2", "3/4"
  const fracMatch = trimmed.match(/^(\d+)\/(\d+)$/)
  if (fracMatch) return parseInt(fracMatch[1]) / parseInt(fracMatch[2])
  // Handle mixed numbers like "1 1/2"
  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixedMatch) return parseInt(mixedMatch[1]) + parseInt(mixedMatch[2]) / parseInt(mixedMatch[3])
  const num = parseFloat(trimmed)
  return isNaN(num) ? null : num
}

// F33: format a scaled quantity back to a readable string
function formatQuantity(value: number): string {
  if (value === Math.floor(value)) return String(value)
  // Round to nearest 1/8 for natural fractions
  const fractions: [number, string][] = [
    [0.125, '1/8'], [0.25, '1/4'], [0.333, '1/3'], [0.5, '1/2'],
    [0.667, '2/3'], [0.75, '3/4'], [0.875, '7/8'],
  ]
  const whole = Math.floor(value)
  const frac = value - whole
  if (frac < 0.06) return whole > 0 ? String(whole) : '0'
  // Find nearest fraction
  let best = fractions[0]
  for (const f of fractions) {
    if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f
  }
  return whole > 0 ? `${whole} ${best[1]}` : best[1]
}

export function RecipeDetailClient({ recipe, collections = [] }: Props) {
  const recipeData = recipe.recipeData as RecipeData
  const [nutrition, setNutrition] = useState<RecipeData['nutrition'] | null>(
    recipe.nutrition as RecipeData['nutrition'] | null
  )
  const [isEstimatingNutrition, setIsEstimatingNutrition] = useState(false)
  const [modifiedText, setModifiedText] = useState('')
  const [isModifying, setIsModifying] = useState(false)

  // F33: Serving size slider — originalServings is fixed at parse time, never changes
  const originalServings = recipe.servings ?? 4
  const [servings, setServings] = useState(originalServings)

  // Substitution panel state
  const [substitutingIngredient, setSubstitutingIngredient] = useState<Ingredient | null>(null)
  // Quick-swap overrides: map from original ingredient name → swapped-in display string
  const [swappedIngredients, setSwappedIngredients] = useState<Map<string, string>>(new Map())

  const handleEstimateNutrition = async () => {
    setIsEstimatingNutrition(true)
    try {
      const res = await fetch(`/api/recipes/${recipe.id}/nutrition`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setNutrition(data.nutrition)
      }
    } finally {
      setIsEstimatingNutrition(false)
    }
  }

  const handleSwap = (original: Ingredient, substitute: { name: string; quantity: string }) => {
    setSwappedIngredients(prev => {
      const next = new Map(prev)
      next.set(original.name, `${substitute.quantity} ${substitute.name}`)
      return next
    })
  }

  const totalMin = (recipe.prepTimeMin || 0) + (recipe.cookTimeMin || 0)

  const handleModified = async (action: string, options: Record<string, unknown>) => {
    setIsModifying(true)
    setModifiedText('')

    try {
      const res = await fetch(`/api/recipes/${recipe.id}/modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...options }),
      })

      if (!res.ok) {
        setModifiedText('Failed to modify recipe.')
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setModifiedText(prev => prev + decoder.decode(value, { stream: true }))
      }
    } catch {
      setModifiedText('An error occurred.')
    } finally {
      setIsModifying(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      {/* Back button */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/kitchen">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Kitchen
        </Link>
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground text-balance">{recipe.title}</h1>
        {recipe.description && (
          <p className="text-muted-foreground mt-2">{recipe.description}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-3">
          {recipe.cuisine && <Badge variant="secondary">{recipe.cuisine}</Badge>}
          {recipe.difficulty && <Badge variant="outline">{recipe.difficulty}</Badge>}
          {totalMin > 0 && (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {totalMin} min
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {servings} serving{servings !== 1 ? 's' : ''}
            {servings !== originalServings && (
              <span className="text-primary font-medium">(scaled)</span>
            )}
          </span>
        </div>

        {/* F33: Serving size slider */}
        <div className="mt-4 flex items-center gap-4 max-w-xs">
          <span className="text-xs text-muted-foreground shrink-0">Servings:</span>
          <Slider
            min={1}
            max={12}
            step={1}
            value={[servings]}
            onValueChange={([v]) => setServings(v)}
            className="flex-1"
            aria-label="Adjust servings"
          />
          <span className="text-sm font-semibold text-foreground w-6 text-center shrink-0">{servings}</span>
          {servings !== originalServings && (
            <button
              onClick={() => setServings(originalServings)}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Tags (F38) */}
      <RecipeTags recipeId={recipe.id} initialTags={recipe.tags ?? []} />

      {/* F51: Personal star rating */}
      <RecipeRating recipeId={recipe.id} initialRating={recipe.rating ?? null} />

      {/* Actions row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* F29: Cooking mode */}
        <Button variant="default" size="sm" asChild className="gap-1.5">
          <Link href={`/kitchen/cook/${recipe.id}`}>
            <UtensilsCrossed className="h-3.5 w-3.5" />
            Cook Mode
          </Link>
        </Button>
        <GroceryListSheet ingredients={recipeData.ingredients ?? []} />
        {/* F41: Cooked this */}
        <CookedThisButton
          recipeId={recipe.id}
          initialCookedCount={recipe.cookedCount ?? 0}
          initialLastCookedAt={recipe.lastCookedAt}
        />
        {/* F39: Collection picker */}
        <CollectionPicker
          recipeId={recipe.id}
          collections={collections}
          currentCollectionId={recipe.collectionId}
        />
        {/* F40: Print */}
        <Button variant="outline" size="sm" asChild>
          <Link href={`/recipe/${recipe.id}/print`} target="_blank" rel="noopener noreferrer">
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Print
          </Link>
        </Button>
      </div>

      {/* Modification toolbar */}
      <ModificationToolbar
        recipeId={recipe.id}
        servings={recipe.servings}
        onModified={handleModified}
      />

      {/* Modification stream output */}
      {(modifiedText || isModifying) && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
          <div className="flex items-center gap-2 mb-3">
            {isModifying && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            <h3 className="text-sm font-medium text-primary">Modified Recipe</h3>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
              {modifiedText}
            </pre>
          </div>
        </div>
      )}

      {/* Ingredients */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">Ingredients</h2>
        <ul className="space-y-2">
          {recipeData.ingredients?.map((ing, i) => {
            const swapped = swappedIngredients.get(ing.name)
            // F33: scale amount by servings ratio
            const scaledAmount = (() => {
              const ratio = servings / originalServings
              if (ratio === 1) return `${ing.amount} ${ing.unit}`.trim()
              const qty = parseQuantity(ing.amount)
              if (qty === null) return `${ing.amount} ${ing.unit}`.trim()
              return `${formatQuantity(qty * ratio)} ${ing.unit}`.trim()
            })()
            return (
              <li
                key={i}
                className={cn(
                  'flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0 group',
                  swapped && 'opacity-75',
                )}
              >
                <span className={cn(
                  'font-medium text-sm w-20 shrink-0 text-right',
                  swapped ? 'text-muted-foreground line-through' : 'text-primary',
                )}>
                  {scaledAmount}
                </span>
                <span className={cn(
                  'text-foreground text-sm flex-1',
                  swapped && 'line-through text-muted-foreground',
                )}>
                  {ing.name}
                </span>
                {swapped ? (
                  <span className="text-xs text-primary font-medium bg-primary/10 rounded-md px-2 py-0.5 shrink-0">
                    → {swapped}
                  </span>
                ) : null}
                <button
                  onClick={() => setSubstitutingIngredient(ing)}
                  title={`I'm missing ${ing.name}`}
                  className={cn(
                    'shrink-0 rounded-md p-1 text-muted-foreground transition-colors',
                    'hover:text-primary hover:bg-primary/10',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                  )}
                  aria-label={`Substitute for ${ing.name}`}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
        {swappedIngredients.size > 0 && (
          <button
            onClick={() => setSwappedIngredients(new Map())}
            className="mt-3 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Reset all substitutions
          </button>
        )}
      </section>

      {/* Substitution panel */}
      <SubstitutionPanel
        recipeId={recipe.id}
        ingredient={substitutingIngredient}
        onClose={() => setSubstitutingIngredient(null)}
        onSwap={handleSwap}
      />

      {/* Instructions */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">Instructions</h2>
        <ol className="space-y-4">
          {recipeData.steps?.map((step, i) => (
            <li key={i} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                {i + 1}
              </span>
              <p className="text-foreground pt-0.5 leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Notes */}
      {recipeData.notes && (
        <section className="rounded-lg border border-border bg-muted/30 p-4">
          <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Chef&apos;s Notes
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{recipeData.notes}</p>
        </section>
      )}

      {/* F36: Nutrition */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Nutrition</h2>
          {!nutrition && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEstimateNutrition}
              disabled={isEstimatingNutrition}
            >
              {isEstimatingNutrition ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Estimating…
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Estimate Nutrition
                </>
              )}
            </Button>
          )}
        </div>

        {nutrition ? (
          // Nutrition facts panel — styled after the familiar FDA label aesthetic
          <div className="rounded-xl border-2 border-border overflow-hidden max-w-xs">
            <div className="bg-foreground text-background px-4 py-3">
              <p className="font-black text-2xl leading-none">Nutrition Facts</p>
              <p className="text-xs mt-1 opacity-80">Per serving · AI estimate</p>
            </div>

            {/* Calories — prominent callout */}
            <div className="px-4 py-3 border-b-4 border-border flex items-end justify-between">
              <p className="text-sm font-medium text-muted-foreground">Calories</p>
              <p className="text-5xl font-black text-foreground leading-none">{nutrition.calories}</p>
            </div>

            {/* Macros list */}
            <dl className="divide-y divide-border/60 px-4">
              {[
                { label: 'Protein', value: nutrition.protein },
                { label: 'Total Fat', value: nutrition.fat },
                { label: 'Total Carbs', value: nutrition.carbs },
                { label: 'Fiber', value: nutrition.fiber },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2.5">
                  <dt className="text-sm font-semibold text-foreground">{label}</dt>
                  <dd className="text-sm text-foreground">
                    <span className="font-bold">{value}</span>
                    <span className="text-muted-foreground text-xs ml-0.5">g</span>
                  </dd>
                </div>
              ))}
            </dl>

            <div className="px-4 py-2 bg-muted/40 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Values are approximate. Generated by AI from ingredient list.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No nutrition data yet. Click &ldquo;Estimate Nutrition&rdquo; to have AI calculate
            approximate values from the ingredient list.
          </p>
        )}
      </section>
    </div>
  )
}
