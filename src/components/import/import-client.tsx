'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Link2, Loader2, Clock, Users, Save, ChefHat, AlertCircle,
  ArrowRight, BookOpen, Utensils,
} from 'lucide-react'

interface Ingredient {
  name: string
  amount: string
  unit: string
}

interface ExtractedRecipe {
  title: string
  description?: string
  servings?: number
  prepTimeMin?: number
  cookTimeMin?: number
  cuisine?: string
  difficulty?: 'easy' | 'medium' | 'hard'
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
  dietaryTags?: string[]
  sourceUrl?: string
}

const difficultyColor = {
  easy: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  hard: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export function ImportClient() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recipe, setRecipe] = useState<ExtractedRecipe | null>(null)

  const handleExtract = async () => {
    const trimmed = url.trim()
    if (!trimmed) return

    setIsExtracting(true)
    setError(null)
    setRecipe(null)

    try {
      const res = await fetch('/api/recipes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to extract recipe')
        return
      }

      setRecipe(data.recipe)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleSave = async () => {
    if (!recipe) return

    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/recipes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ save: true, recipeData: recipe }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to save recipe')
        return
      }

      router.push(`/recipe/${data.id}`)
    } catch {
      setError('Failed to save recipe. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleExtract()
    }
  }

  const totalMin = (recipe?.prepTimeMin || 0) + (recipe?.cookTimeMin || 0)

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Link2 className="h-6 w-6 text-primary" />
          Import Recipe from URL
        </h1>
        <p className="text-muted-foreground mt-1">
          Paste a recipe link from any cooking site and we&apos;ll extract it into your collection.
        </p>
      </div>

      {/* URL Input */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://www.allrecipes.com/recipe/..."
            disabled={isExtracting}
            className="h-11"
          />
        </div>
        <Button
          onClick={handleExtract}
          disabled={!url.trim() || isExtracting}
          className="h-11 px-6"
        >
          {isExtracting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Extracting...
            </>
          ) : (
            <>
              <Utensils className="h-4 w-4 mr-2" />
              Import Recipe
            </>
          )}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isExtracting && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="border-t border-border pt-4 space-y-3">
            <Skeleton className="h-5 w-32" />
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
          <div className="border-t border-border pt-4 space-y-3">
            <Skeleton className="h-5 w-32" />
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      )}

      {/* Recipe Preview */}
      {recipe && !isExtracting && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Preview header */}
          <div className="bg-primary/5 border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <ChefHat className="h-4 w-4" />
                Recipe Preview
              </div>
              <Button onClick={handleSave} disabled={isSaving} size="sm">
                {isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 mr-2" />
                    Save to Collection
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Title & metadata */}
            <div>
              <h2 className="text-2xl font-bold text-foreground text-balance">{recipe.title}</h2>
              {recipe.description && (
                <p className="text-muted-foreground mt-2 leading-relaxed">{recipe.description}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {recipe.cuisine && <Badge variant="secondary">{recipe.cuisine}</Badge>}
                {recipe.difficulty && (
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${difficultyColor[recipe.difficulty]}`}>
                    {recipe.difficulty}
                  </span>
                )}
                {totalMin > 0 && (
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {totalMin} min
                    {recipe.prepTimeMin && recipe.cookTimeMin && (
                      <span className="text-xs">
                        ({recipe.prepTimeMin}m prep + {recipe.cookTimeMin}m cook)
                      </span>
                    )}
                  </span>
                )}
                {recipe.servings && (
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {recipe.servings} servings
                  </span>
                )}
              </div>
              {recipe.dietaryTags && recipe.dietaryTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {recipe.dietaryTags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Ingredients */}
            <section>
              <h3 className="text-lg font-semibold text-foreground mb-3">Ingredients</h3>
              <ul className="space-y-1.5">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-start gap-3 py-1 border-b border-border/50 last:border-0">
                    <span className="text-primary font-medium text-sm w-20 shrink-0 text-right">
                      {ing.amount} {ing.unit}
                    </span>
                    <span className="text-foreground text-sm">{ing.name}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Steps */}
            <section>
              <h3 className="text-lg font-semibold text-foreground mb-3">Instructions</h3>
              <ol className="space-y-3">
                {recipe.steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs">
                      {i + 1}
                    </span>
                    <p className="text-foreground text-sm pt-0.5 leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            </section>

            {/* Notes */}
            {recipe.notes && (
              <section className="rounded-lg border border-border bg-muted/30 p-4">
                <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Notes
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{recipe.notes}</p>
              </section>
            )}

            {/* Nutrition */}
            {recipe.nutrition && (
              <section>
                <h3 className="text-lg font-semibold text-foreground mb-3">Nutrition (per serving)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: 'Calories', value: recipe.nutrition.calories, unit: 'kcal' },
                    { label: 'Protein', value: recipe.nutrition.protein, unit: 'g' },
                    { label: 'Fat', value: recipe.nutrition.fat, unit: 'g' },
                    { label: 'Carbs', value: recipe.nutrition.carbs, unit: 'g' },
                    { label: 'Fiber', value: recipe.nutrition.fiber, unit: 'g' },
                  ].map(({ label, value, unit }) => (
                    <div key={label} className="rounded-lg border border-border bg-card p-2.5 text-center">
                      <p className="text-xl font-bold text-primary">{value}</p>
                      <p className="text-xs text-muted-foreground">{unit}</p>
                      <p className="text-xs font-medium text-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Source */}
            {recipe.sourceUrl && (
              <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                Imported from{' '}
                <a
                  href={recipe.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {new URL(recipe.sourceUrl).hostname}
                </a>
              </p>
            )}
          </div>

          {/* Bottom save bar */}
          <div className="border-t border-border bg-muted/30 px-6 py-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Looks good? Save it to your collection.
            </p>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Recipe
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!recipe && !isExtracting && !error && (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Link2 className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Paste any recipe URL</h2>
          <p className="text-muted-foreground max-w-sm">
            Works with Allrecipes, NYT Cooking, food blogs, and most recipe sites.
            We&apos;ll extract the ingredients, steps, and nutrition info automatically.
          </p>
        </div>
      )}
    </div>
  )
}
