'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, X, ShoppingCart, Check, Copy, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MEALS = ['breakfast', 'lunch', 'dinner'] as const
const MEAL_LABELS: Record<string, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }

interface SlimRecipe {
  id: string
  title: string
  cuisine?: string | null
  difficulty?: string | null
}

interface Slot {
  id: string
  dayOfWeek: number
  mealType: string
  recipeId: string
  recipe: SlimRecipe
}

interface PlanData {
  slots: Slot[]
}

interface GroceryItemState {
  checked: boolean
}

interface MealPlannerClientProps {
  weekStart: string // ISO date string (Monday)
  initialPlan: PlanData
  savedRecipes: SlimRecipe[]
}

function getWeekLabel(weekStart: string) {
  const d = new Date(weekStart)
  // d is Monday; Sunday is d - 1 day
  const sunday = new Date(d)
  sunday.setUTCDate(d.getUTCDate() - 1)
  const saturday = new Date(d)
  saturday.setUTCDate(d.getUTCDate() + 5)
  const fmt = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `${fmt(sunday)} – ${fmt(saturday)}`
}

export function MealPlannerClient({
  weekStart,
  initialPlan,
  savedRecipes,
}: MealPlannerClientProps) {
  const [slots, setSlots] = useState<Slot[]>(initialPlan.slots)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerDay, setPickerDay] = useState<number | null>(null)
  const [pickerMeal, setPickerMeal] = useState<string | null>(null)
  const [pickerSearch, setPickerSearch] = useState('')

  const [groceryOpen, setGroceryOpen] = useState(false)
  const [groceryChecked, setGroceryChecked] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)

  const [loading, setLoading] = useState<string | null>(null) // `${day}-${meal}` or slot id

  const getSlot = (day: number, meal: string) =>
    slots.find(s => s.dayOfWeek === day && s.mealType === meal)

  const openPicker = (day: number, meal: string) => {
    setPickerDay(day)
    setPickerMeal(meal)
    setPickerSearch('')
    setPickerOpen(true)
  }

  const filteredPickerRecipes = useMemo(() => {
    if (!pickerSearch) return savedRecipes
    return savedRecipes.filter(r =>
      r.title.toLowerCase().includes(pickerSearch.toLowerCase())
    )
  }, [savedRecipes, pickerSearch])

  const assignRecipe = async (recipe: SlimRecipe) => {
    if (pickerDay === null || pickerMeal === null) return
    const key = `${pickerDay}-${pickerMeal}`
    setLoading(key)
    setPickerOpen(false)

    try {
      const res = await fetch('/api/meal-plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStart,
          dayOfWeek: pickerDay,
          mealType: pickerMeal,
          recipeId: recipe.id,
        }),
      })
      if (res.ok) {
        const newSlot = await res.json() as Slot
        setSlots(prev => {
          const filtered = prev.filter(
            s => !(s.dayOfWeek === pickerDay && s.mealType === pickerMeal)
          )
          return [...filtered, newSlot]
        })
      }
    } finally {
      setLoading(null)
    }
  }

  const removeSlot = async (slot: Slot) => {
    setLoading(slot.id)
    try {
      await fetch(`/api/meal-plan/slot/${slot.id}`, { method: 'DELETE' })
      setSlots(prev => prev.filter(s => s.id !== slot.id))
    } finally {
      setLoading(null)
    }
  }

  // Build grocery list from all assigned recipes' ingredients
  // We use recipe titles as keys since we only have slim recipe data here;
  // full ingredient data requires fetching. We'll show recipe names grouped.
  const assignedRecipes = useMemo(() => {
    const seen = new Set<string>()
    const result: SlimRecipe[] = []
    for (const slot of slots) {
      if (!seen.has(slot.recipeId)) {
        seen.add(slot.recipeId)
        result.push(slot.recipe)
      }
    }
    return result
  }, [slots])

  // We use recipe ID as the grocery item key
  const toggleGroceryItem = useCallback((id: string) => {
    setGroceryChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleCopyGrocery = async () => {
    const text = assignedRecipes
      .filter(r => !groceryChecked.has(r.id))
      .map(r => `• ${r.title}`)
      .join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const uncheckedCount = assignedRecipes.filter(r => !groceryChecked.has(r.id)).length

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meal Planner</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{getWeekLabel(weekStart)}</p>
        </div>
        <Button
          onClick={() => { setGroceryChecked(new Set()); setGroceryOpen(true) }}
          disabled={slots.length === 0}
          className="gap-2 self-start sm:self-auto"
        >
          <ShoppingCart className="h-4 w-4" />
          Grocery List
        </Button>
      </div>

      {savedRecipes.length === 0 && (
        <div className="rounded-xl border border-border bg-muted/30 p-6 text-center">
          <p className="text-muted-foreground text-sm">
            You need saved recipes before you can plan meals.{' '}
            <Link href="/kitchen" className="text-primary underline-offset-4 hover:underline">
              Cook something first!
            </Link>
          </p>
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="min-w-[580px] px-4 sm:px-0">
          {/* Day headers */}
          <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 mb-1">
            <div />
            {DAYS.map(day => (
              <div
                key={day}
                className="text-center text-xs font-semibold text-muted-foreground py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Meal rows */}
          {MEALS.map(meal => (
            <div key={meal} className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 mb-1">
              {/* Row label */}
              <div className="flex items-center">
                <span className="text-xs font-medium text-muted-foreground capitalize">
                  {MEAL_LABELS[meal]}
                </span>
              </div>
              {/* Cells: 0=Sun ... 6=Sat */}
              {[0, 1, 2, 3, 4, 5, 6].map(day => {
                const slot = getSlot(day, meal)
                const key = `${day}-${meal}`
                const isLoading = loading === key || (slot && loading === slot.id)
                return (
                  <div
                    key={day}
                    className={cn(
                      'min-h-[72px] rounded-lg border border-border bg-card p-1.5 flex flex-col',
                      slot ? 'border-primary/20 bg-primary/5' : 'hover:border-primary/20',
                    )}
                  >
                    {slot ? (
                      <div className="flex flex-col h-full gap-1">
                        <div className="flex items-start justify-between gap-0.5">
                          <Link
                            href={`/recipe/${slot.recipeId}`}
                            className="text-xs font-medium text-foreground leading-tight hover:text-primary transition-colors line-clamp-2"
                          >
                            {slot.recipe.title}
                          </Link>
                          <button
                            onClick={() => removeSlot(slot)}
                            disabled={!!isLoading}
                            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            aria-label="Remove"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        {slot.recipe.cuisine && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 w-fit">
                            {slot.recipe.cuisine}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => openPicker(day, meal)}
                        disabled={!!isLoading}
                        className={cn(
                          'flex h-full w-full items-center justify-center rounded-md',
                          'text-muted-foreground hover:text-primary hover:bg-primary/5',
                          'transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                          'disabled:opacity-40 disabled:cursor-not-allowed',
                          savedRecipes.length === 0 && 'opacity-40',
                        )}
                        aria-label="Add recipe"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Recipe picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Pick a Recipe —{' '}
              <span className="text-primary capitalize">
                {pickerMeal && MEAL_LABELS[pickerMeal]},{' '}
                {pickerDay !== null && DAYS[pickerDay]}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search saved recipes..."
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
                className="pl-8"
                autoFocus
              />
            </div>
            <ul className="max-h-72 overflow-y-auto space-y-1 pr-1">
              {filteredPickerRecipes.length === 0 ? (
                <li className="text-sm text-center text-muted-foreground py-6">No recipes match.</li>
              ) : (
                filteredPickerRecipes.map(recipe => {
                  const alreadyPicked =
                    pickerDay !== null &&
                    pickerMeal !== null &&
                    getSlot(pickerDay, pickerMeal)?.recipeId === recipe.id
                  return (
                    <li key={recipe.id}>
                      <button
                        onClick={() => assignRecipe(recipe)}
                        className={cn(
                          'w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-left',
                          'hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          alreadyPicked && 'text-primary',
                        )}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium leading-tight">{recipe.title}</span>
                          {recipe.cuisine && (
                            <span className="text-xs text-muted-foreground">{recipe.cuisine}</span>
                          )}
                        </div>
                        {alreadyPicked && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        </DialogContent>
      </Dialog>

      {/* Grocery list dialog */}
      <Dialog open={groceryOpen} onOpenChange={setGroceryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              This Week&apos;s Grocery List
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {uncheckedCount} recipe{uncheckedCount !== 1 ? 's' : ''} to shop for
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyGrocery}
                disabled={uncheckedCount === 0}
                className="gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy all
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground border border-border/50 rounded-md p-2 bg-muted/20">
              Open each recipe to see the full ingredient list with amounts. Check off recipes as you shop.
            </p>

            <ul className="max-h-72 overflow-y-auto space-y-1 pr-1">
              {assignedRecipes.map(recipe => (
                <li key={recipe.id}>
                  <button
                    onClick={() => toggleGroceryItem(recipe.id)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-left',
                      'hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      groceryChecked.has(recipe.id) && 'opacity-50',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input transition-colors',
                        groceryChecked.has(recipe.id) && 'bg-primary border-primary',
                      )}
                    >
                      {groceryChecked.has(recipe.id) && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </span>
                    <span
                      className={cn(
                        'flex-1 font-medium transition-colors',
                        groceryChecked.has(recipe.id) && 'line-through text-muted-foreground',
                      )}
                    >
                      {recipe.title}
                    </span>
                    <Link
                      href={`/recipe/${recipe.id}`}
                      onClick={e => e.stopPropagation()}
                      className="text-xs text-primary hover:underline underline-offset-4 shrink-0"
                    >
                      View
                    </Link>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
