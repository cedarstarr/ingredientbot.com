'use client'

import { useEffect } from 'react'
import { Clock, Users, ChefHat } from 'lucide-react'

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
}

interface NutritionData {
  calories: number
  protein: number
  fat: number
  carbs: number
  fiber: number
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
  nutrition?: unknown
  createdAt: string | Date
}

export function PrintRecipeView({ recipe }: { recipe: Recipe }) {
  const recipeData = recipe.recipeData as RecipeData
  const nutrition = recipe.nutrition as NutritionData | null
  const totalMin = (recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0)

  // Auto-trigger print dialog when the page loads so clicking the button opens print directly
  useEffect(() => {
    // Small delay so the page renders fully before the dialog opens
    const timer = setTimeout(() => window.print(), 400)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      {/* Print controls — hidden when actually printing */}
      <div className="print:hidden flex items-center justify-between p-4 border-b border-border bg-background sticky top-0 z-10">
        <button
          onClick={() => window.history.back()}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-2 py-1"
        >
          ← Back
        </button>
        <button
          onClick={() => window.print()}
          className="text-sm font-medium bg-primary text-primary-foreground rounded-md px-4 py-1.5 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Print / Save PDF
        </button>
      </div>

      {/* Recipe content — print-optimised */}
      <article className="max-w-2xl mx-auto px-8 py-10 print:px-0 print:py-0 print:max-w-none font-sans">
        {/* Site attribution — only shows on print */}
        <p className="hidden print:block text-xs text-gray-400 mb-6">
          Printed from ingredientbot.com
        </p>

        {/* Title & meta */}
        <header className="mb-8 pb-6 border-b-2 border-gray-900 print:border-gray-800">
          <h1 className="text-4xl font-bold text-foreground print:text-black leading-tight text-balance">
            {recipe.title}
          </h1>
          {recipe.description && (
            <p className="mt-3 text-muted-foreground print:text-gray-600 text-lg leading-relaxed">
              {recipe.description}
            </p>
          )}

          {/* Quick stats */}
          <div className="mt-4 flex flex-wrap gap-6 text-sm text-muted-foreground print:text-gray-600">
            {totalMin > 0 && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 shrink-0" />
                {recipe.prepTimeMin ? `Prep: ${recipe.prepTimeMin} min` : ''}
                {recipe.prepTimeMin && recipe.cookTimeMin ? ' · ' : ''}
                {recipe.cookTimeMin ? `Cook: ${recipe.cookTimeMin} min` : ''}
                {' · '}
                <strong className="text-foreground print:text-black">Total: {totalMin} min</strong>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 shrink-0" />
              {recipe.servings} servings
            </span>
            {(recipe.cuisine || recipe.difficulty) && (
              <span className="flex items-center gap-1.5">
                <ChefHat className="h-4 w-4 shrink-0" />
                {[recipe.cuisine, recipe.difficulty].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
        </header>

        {/* Two-column layout for print: ingredients left, instructions right */}
        <div className="print:grid print:grid-cols-[2fr_3fr] print:gap-10">
          {/* Ingredients */}
          <section className="mb-8 print:mb-0">
            <h2 className="text-xl font-bold text-foreground print:text-black mb-4 uppercase tracking-wide text-sm">
              Ingredients
            </h2>
            <ul className="space-y-2">
              {recipeData.ingredients?.map((ing, i) => (
                <li key={i} className="flex gap-3 text-sm leading-snug">
                  <span className="font-semibold w-16 shrink-0 text-right text-foreground print:text-black">
                    {ing.amount} {ing.unit}
                  </span>
                  <span className="text-foreground print:text-black">{ing.name}</span>
                </li>
              ))}
            </ul>

            {/* Nutrition facts — shown in sidebar on print */}
            {nutrition && (
              <div className="mt-8 rounded-lg border-2 border-gray-900 print:border-gray-800 p-4 print:block">
                <h3 className="font-bold text-sm uppercase tracking-wide mb-3 text-foreground print:text-black border-b border-gray-300 pb-2">
                  Nutrition Facts
                </h3>
                <p className="text-xs text-muted-foreground print:text-gray-500 mb-3">Per serving</p>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between border-b border-gray-200 pb-1.5">
                    <dt className="font-bold text-foreground print:text-black">Calories</dt>
                    <dd className="font-bold text-foreground print:text-black">{nutrition.calories} kcal</dd>
                  </div>
                  {[
                    { label: 'Protein', value: nutrition.protein },
                    { label: 'Total Fat', value: nutrition.fat },
                    { label: 'Total Carbs', value: nutrition.carbs },
                    { label: 'Fiber', value: nutrition.fiber },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-foreground print:text-black">
                      <dt>{label}</dt>
                      <dd>{value}g</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-xs text-muted-foreground print:text-gray-400 mt-3">
                  AI estimate — values are approximate
                </p>
              </div>
            )}
          </section>

          {/* Instructions */}
          <section className="mb-8 print:mb-0">
            <h2 className="text-xl font-bold text-foreground print:text-black mb-4 uppercase tracking-wide text-sm">
              Instructions
            </h2>
            <ol className="space-y-4">
              {recipeData.steps?.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white print:bg-gray-800 font-bold text-xs mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-foreground print:text-black flex-1">{step}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Notes */}
        {recipeData.notes && (
          <section className="mt-6 pt-6 border-t border-border print:border-gray-300">
            <h3 className="font-bold text-sm uppercase tracking-wide mb-2 text-foreground print:text-black">
              Chef&apos;s Notes
            </h3>
            <p className="text-sm text-muted-foreground print:text-gray-600 leading-relaxed">
              {recipeData.notes}
            </p>
          </section>
        )}

        {/* Footer — print only */}
        <footer className="hidden print:block mt-10 pt-4 border-t border-gray-300 text-xs text-gray-400">
          Generated by IngredientBot · ingredientbot.com
        </footer>
      </article>
    </>
  )
}
