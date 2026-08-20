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
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, X, ShoppingCart, Check, Copy, Search, Clock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toaster'

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

// F90: meal timing orchestrator — one interleaved step across 2-3 recipes cooked together.
interface TimelineStep {
  minuteOffset: number
  recipeId: string
  recipeTitle: string
  instruction: string
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
  const { toast } = useToast()
  const [slots, setSlots] = useState<Slot[]>(initialPlan.slots)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerDay, setPickerDay] = useState<number | null>(null)
  const [pickerMeal, setPickerMeal] = useState<string | null>(null)
  const [pickerSearch, setPickerSearch] = useState('')

  const [groceryOpen, setGroceryOpen] = useState(false)
  const [groceryChecked, setGroceryChecked] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)

  const [loading, setLoading] = useState<string | null>(null) // `${day}-${meal}` or slot id

  // F90: meal timing orchestrator state — timeline is client-cached only, never persisted.
  const [orchestrateDay, setOrchestrateDay] = useState<number | null>(null)
  const [orchestrateSelectedIds, setOrchestrateSelectedIds] = useState<Set<string>>(new Set())
  const [orchestrating, setOrchestrating] = useState(false)
  const [orchestrateError, setOrchestrateError] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<TimelineStep[] | null>(null)
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set())

  const getSlot = (day: number, meal: string) =>
    slots.find(s => s.dayOfWeek === day && s.mealType === meal)

  // F90: unique recipes assigned to each day, across all three meals — the
  // candidate pool for "cook together". Recompute only when slots change.
  const dayRecipes = useMemo(() => {
    const map = new Map<number, SlimRecipe[]>()
    for (const day of [0, 1, 2, 3, 4, 5, 6]) {
      const seen = new Set<string>()
      const list: SlimRecipe[] = []
      for (const meal of MEALS) {
        const slot = getSlot(day, meal)
        if (slot && !seen.has(slot.recipeId)) {
          seen.add(slot.recipeId)
          list.push(slot.recipe)
        }
      }
      if (list.length >= 2) map.set(day, list)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots])

  const selectOrchestrateDay = (day: number) => {
    setOrchestrateDay(day)
    setOrchestrateSelectedIds(new Set())
    setTimeline(null)
    setCheckedSteps(new Set())
    setOrchestrateError(null)
  }

  const toggleOrchestrateRecipe = (id: string, include: boolean) => {
    setOrchestrateSelectedIds(prev => {
      const next = new Set(prev)
      if (include) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const runOrchestrate = async () => {
    if (orchestrateSelectedIds.size < 2 || orchestrating) return
    setOrchestrating(true)
    setOrchestrateError(null)
    setTimeline(null)
    setCheckedSteps(new Set())
    try {
      const res = await fetch('/api/meal-plan/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeIds: [...orchestrateSelectedIds] }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !Array.isArray(data?.steps)) {
        setOrchestrateError(typeof data?.error === 'string' ? data.error : "couldn't build a timeline just now")
        return
      }
      setTimeline(data.steps as TimelineStep[])
    } catch {
      setOrchestrateError("couldn't build a timeline just now")
    } finally {
      setOrchestrating(false)
    }
  }

  const toggleStepChecked = (index: number) => {
    setCheckedSteps(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

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
      } else {
        toast({ title: 'Could not add recipe to plan', description: 'Please try again.', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Could not add recipe to plan', description: 'Please try again.', variant: 'destructive' })
    } finally {
      setLoading(null)
    }
  }

  const removeSlot = async (slot: Slot) => {
    setLoading(slot.id)
    try {
      const res = await fetch(`/api/meal-plan/slot/${slot.id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast({ title: 'Could not remove recipe from plan', description: 'Please try again.', variant: 'destructive' })
        return
      }
      setSlots(prev => prev.filter(s => s.id !== slot.id))
    } catch {
      toast({ title: 'Could not remove recipe from plan', description: 'Please try again.', variant: 'destructive' })
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

      {/* F90: meal timing orchestrator — combine 2-3 of a day's recipes into one interleaved timeline */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Cook Together
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pick 2–3 recipes from the same day and get one interleaved timeline so everything&apos;s ready at once.
          </p>
        </div>

        {dayRecipes.size === 0 ? (
          <p className="text-sm text-muted-foreground">
            Assign at least 2 recipes to the same day above to try this.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {[...dayRecipes.keys()].map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectOrchestrateDay(day)}
                  aria-pressed={orchestrateDay === day}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    orchestrateDay === day
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground',
                  )}
                >
                  {DAYS[day]}
                </button>
              ))}
            </div>

            {orchestrateDay !== null && (
              <div className="space-y-3">
                <ul className="space-y-1">
                  {(dayRecipes.get(orchestrateDay) ?? []).map(recipe => {
                    const checked = orchestrateSelectedIds.has(recipe.id)
                    const disabled = !checked && orchestrateSelectedIds.size >= 3
                    return (
                      <li key={recipe.id}>
                        <label
                          className={cn(
                            'flex items-center gap-2.5 rounded-md px-2 py-1.5 cursor-pointer hover:bg-muted/40 transition-colors',
                            disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent',
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={(v) => toggleOrchestrateRecipe(recipe.id, Boolean(v))}
                            aria-label={`Include ${recipe.title} in the timeline`}
                          />
                          <span className="text-sm text-foreground">{recipe.title}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>

                <Button
                  size="sm"
                  onClick={runOrchestrate}
                  disabled={orchestrateSelectedIds.size < 2 || orchestrating}
                  data-testid="orchestrate-button"
                  className="gap-1.5"
                >
                  {orchestrating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
                  Build timeline
                </Button>

                {orchestrateError && (
                  <p role="alert" className="text-sm text-destructive">{orchestrateError}</p>
                )}

                {timeline && timeline.length > 0 && (
                  <ol
                    data-testid="orchestrate-timeline"
                    className="mt-2 space-y-1.5 border-l-2 border-border pl-4"
                  >
                    {timeline.map((step, i) => {
                      const stepChecked = checkedSteps.has(i)
                      return (
                        <li key={i} className="relative">
                          <span
                            className="absolute -left-5.25 top-2.5 h-2.5 w-2.5 rounded-full bg-primary"
                            aria-hidden="true"
                          />
                          <label
                            className={cn(
                              'flex items-start gap-2.5 rounded-md px-2 py-1.5 -ml-2 cursor-pointer hover:bg-muted/40 transition-colors',
                              stepChecked && 'opacity-60',
                            )}
                          >
                            <Checkbox
                              checked={stepChecked}
                              onCheckedChange={() => toggleStepChecked(i)}
                              aria-label={`Mark step ${i + 1} done`}
                              className="mt-0.5"
                            />
                            <span className="flex-1 min-w-0">
                              <span className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono text-muted-foreground">+{step.minuteOffset}m</span>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {step.recipeTitle}
                                </Badge>
                              </span>
                              <span className={cn('block text-sm text-foreground mt-0.5', stepChecked && 'line-through')}>
                                {step.instruction}
                              </span>
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ol>
                )}
              </div>
            )}
          </>
        )}
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
                          <span className="font-medium leading-tight truncate">{recipe.title}</span>
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
                    <Check className="h-3.5 w-3.5 text-[hsl(var(--color-success))]" />
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
                        'flex-1 font-medium transition-colors truncate',
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
