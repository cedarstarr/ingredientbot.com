'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ModificationToolbar } from './modification-toolbar'
import { GroceryListSheet } from './grocery-list-sheet'
import { SubstitutionPanel } from './substitution-panel'
import { CookedThisButton } from './cooked-this-button'
import { RecipeTags } from './recipe-tags'
import { CollectionPicker } from './collection-picker'
import { Clock, Users, ChevronLeft, Loader2, BookOpen, HelpCircle } from 'lucide-react'
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
}

interface Props {
  recipe: Recipe
  collections?: Collection[]
}

export function RecipeDetailClient({ recipe, collections = [] }: Props) {
  const recipeData = recipe.recipeData as RecipeData
  const nutrition = recipe.nutrition as RecipeData['nutrition'] | null
  const [modifiedText, setModifiedText] = useState('')
  const [isModifying, setIsModifying] = useState(false)

  // Substitution panel state
  const [substitutingIngredient, setSubstitutingIngredient] = useState<Ingredient | null>(null)
  // Quick-swap overrides: map from original ingredient name → swapped-in display string
  const [swappedIngredients, setSwappedIngredients] = useState<Map<string, string>>(new Map())

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
            {recipe.servings} servings
          </span>
        </div>
      </div>

      {/* Tags (F38) */}
      <RecipeTags recipeId={recipe.id} initialTags={recipe.tags ?? []} />

      {/* Actions row */}
      <div className="flex flex-wrap items-center gap-3">
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
                  {ing.amount} {ing.unit}
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

      {/* Nutrition */}
      {nutrition && (
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Nutrition (per serving)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: 'Calories', value: nutrition.calories, unit: 'kcal' },
              { label: 'Protein', value: nutrition.protein, unit: 'g' },
              { label: 'Fat', value: nutrition.fat, unit: 'g' },
              { label: 'Carbs', value: nutrition.carbs, unit: 'g' },
              { label: 'Fiber', value: nutrition.fiber, unit: 'g' },
            ].map(({ label, value, unit }) => (
              <div key={label} className="rounded-lg border border-border bg-card p-3 text-center">
                <p className="text-2xl font-bold text-primary">{value}</p>
                <p className="text-xs text-muted-foreground">{unit}</p>
                <p className="text-xs font-medium text-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
