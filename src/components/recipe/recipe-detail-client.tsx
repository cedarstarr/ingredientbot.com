'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { Clock, Users, ChevronLeft, Loader2, HelpCircle, Printer, Sparkles, UtensilsCrossed, Lightbulb, Save } from 'lucide-react'
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
  const router = useRouter()
  const recipeData = recipe.recipeData as RecipeData
  const [nutrition, setNutrition] = useState<RecipeData['nutrition'] | null>(
    recipe.nutrition as RecipeData['nutrition'] | null
  )
  const [isEstimatingNutrition, setIsEstimatingNutrition] = useState(false)
  const [modifiedText, setModifiedText] = useState('')
  const [isModifying, setIsModifying] = useState(false)

  // Saving an AI variant (modification or substitution) as its own new recipe
  const [isSavingVariant, setIsSavingVariant] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // F33: Serving size slider — originalServings is fixed at parse time, never changes
  const originalServings = recipe.servings ?? 4
  const [servings, setServings] = useState(originalServings)

  // Substitution panel state
  const [substitutingIngredient, setSubstitutingIngredient] = useState<Ingredient | null>(null)
  // Quick-swap overrides: map from original ingredient name → structured substitute
  const [swappedIngredients, setSwappedIngredients] = useState<Map<string, { display: string; name: string; quantity: string }>>(new Map())

  // Ingredient checkbox state
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set())
  const toggleIngredientCheck = (i: number) => {
    setCheckedIngredients(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

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
      next.set(original.name, {
        display: `${substitute.quantity} ${substitute.name}`.trim(),
        name: substitute.name,
        quantity: substitute.quantity,
      })
      return next
    })
  }

  // Persist the current AI variant as a brand-new recipe, then navigate to it.
  const saveVariant = async (payload: Record<string, unknown>) => {
    setIsSavingVariant(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/recipes/${recipe.id}/save-variant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const data = await res.json()
        router.push(`/recipe/${data.id}`)
        return
      }
      if (res.status === 402) {
        setSaveError('You’ve hit your free monthly recipe limit. Upgrade to Pro to save more.')
      } else {
        const data = await res.json().catch(() => null)
        setSaveError(data?.error === 'Failed to structure the modified recipe'
          ? 'Couldn’t read the modified recipe — try regenerating it.'
          : 'Couldn’t save. Please try again.')
      }
    } catch {
      setSaveError('Couldn’t save. Please try again.')
    } finally {
      setIsSavingVariant(false)
    }
  }

  const handleSaveModification = () =>
    saveVariant({ kind: 'modification', modifiedText })

  const handleSaveSubstitutions = () =>
    saveVariant({
      kind: 'substitution',
      swaps: Array.from(swappedIngredients.entries()).map(([original, s]) => ({
        original,
        name: s.name,
        quantity: s.quantity,
      })),
    })

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
    <div className="max-w-[1080px] mx-auto px-10 py-8 pb-16">
      {/* Back button */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/kitchen">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Kitchen
        </Link>
      </Button>

      {/* Header */}
      <div className="mt-4">
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
      <div className="mt-6">
        <RecipeTags recipeId={recipe.id} initialTags={recipe.tags ?? []} />
      </div>

      {/* F51: Personal star rating */}
      <div className="mt-4">
        <RecipeRating recipeId={recipe.id} initialRating={recipe.rating ?? null} />
      </div>

      {/* Actions row */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
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
      <div className="mt-6">
        <ModificationToolbar
          recipeId={recipe.id}
          servings={recipe.servings}
          onModified={handleModified}
        />
      </div>

      {/* Two-column layout: main + sidebar */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

        {/* Left: streaming + ingredients + steps */}
        <div className="space-y-6">

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

              {/* Save the modified version as its own recipe — it's ephemeral until persisted */}
              {!isModifying && modifiedText && (
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-primary/15 pt-4">
                  <Button
                    size="sm"
                    onClick={handleSaveModification}
                    disabled={isSavingVariant}
                    className="gap-1.5"
                  >
                    {isSavingVariant ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Save as new recipe
                  </Button>
                  {saveError && <p className="text-xs text-destructive">{saveError}</p>}
                </div>
              )}
            </div>
          )}

          {/* Ingredients */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">Ingredients</h2>
            <ul className="space-y-0">
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
                      'flex items-start gap-2.5 py-2 border-b border-border/50 last:border-0 group cursor-pointer',
                      checkedIngredients.has(i) && 'opacity-60',
                    )}
                    onClick={() => toggleIngredientCheck(i)}
                  >
                    {/* Checkbox */}
                    <span className={cn(
                      'mt-0.5 flex-shrink-0 h-[18px] w-[18px] rounded border-[1.5px] border-input transition-colors relative',
                      checkedIngredients.has(i) && 'bg-primary border-primary',
                    )}>
                      {checkedIngredients.has(i) && (
                        <svg className="absolute inset-0 m-auto w-2.5 h-2.5 text-primary-foreground" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    {/* Amount */}
                    <span className={cn(
                      'font-medium text-sm w-20 shrink-0 text-right',
                      swapped ? 'text-muted-foreground line-through' : 'text-primary',
                      checkedIngredients.has(i) && 'line-through text-muted-foreground',
                    )}>
                      {scaledAmount}
                    </span>
                    {/* Name */}
                    <span className={cn(
                      'text-foreground text-sm flex-1 leading-snug',
                      (swapped || checkedIngredients.has(i)) && 'line-through text-muted-foreground',
                    )}>
                      {ing.name}
                    </span>
                    {swapped ? (
                      <span className="text-xs text-primary font-medium bg-primary/10 rounded-md px-2 py-0.5 shrink-0">
                        → {swapped.display}
                      </span>
                    ) : null}
                    {/* Substitute button — stopPropagation so it doesn't toggle the checkbox */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setSubstitutingIngredient(ing) }}
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
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  onClick={handleSaveSubstitutions}
                  disabled={isSavingVariant}
                  className="gap-1.5"
                >
                  {isSavingVariant ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save as new recipe
                </Button>
                <button
                  onClick={() => setSwappedIngredients(new Map())}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  Reset all substitutions
                </button>
                {saveError && <p className="text-xs text-destructive w-full">{saveError}</p>}
              </div>
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
                  <span className="rounded-full bg-primary/10 text-primary font-bold text-[13px] flex h-7 w-7 items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed flex-1 pt-0.5">{step}</p>
                </li>
              ))}
            </ol>
          </section>

        </div>

        {/* Right sidebar: nutrition + tip card */}
        <aside className="space-y-4">

          {/* F36: Nutrition */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-foreground">Nutrition</h2>
            </div>

            {nutrition ? (
              // Nutrition facts panel — styled after the familiar FDA label aesthetic
              <div className="rounded-xl border-2 border-border overflow-hidden">
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
                    General AI-generated guidelines — not medical advice.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  No nutrition data yet.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEstimateNutrition}
                  disabled={isEstimatingNutrition}
                  className="w-full"
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
              </div>
            )}
          </section>

          {/* Heads up tip card — shown when notes exist */}
          {recipeData.notes && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-primary mb-2">
                <Lightbulb className="h-3.5 w-3.5" />
                Heads up
              </div>
              <p className="text-[13px] leading-[1.55]">{recipeData.notes}</p>
            </div>
          )}

        </aside>
      </div>
    </div>
  )
}
