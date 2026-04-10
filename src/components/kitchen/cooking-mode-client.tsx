'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  ChevronLeft,
  ChevronRight,
  X,
  Timer,
  Check,
  Flame,
  Users,
  Clock,
  BatteryWarning,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Ingredient {
  name: string
  amount: string
  unit: string
}

interface RecipeData {
  title: string
  ingredients: Ingredient[]
  steps: string[]
  servings?: number
  prepTimeMin?: number
  cookTimeMin?: number
  cuisine?: string
  difficulty?: string
}

interface Recipe {
  id: string
  title: string
  servings: number
  prepTimeMin?: number | null
  cookTimeMin?: number | null
  cuisine?: string | null
  difficulty?: string | null
  recipeData: unknown
}

interface Props {
  recipe: Recipe
}

// Infer per-step timer from keywords in the step text
function inferTimer(step: string): number | null {
  const patterns = [
    { re: /(\d+)[\s-]*to[\s-]*(\d+)\s*minutes?/i, fn: (m: RegExpMatchArray) => Math.ceil((parseInt(m[1]) + parseInt(m[2])) / 2) },
    { re: /(\d+)\s*minutes?/i, fn: (m: RegExpMatchArray) => parseInt(m[1]) },
    { re: /(\d+)\s*(?:to\s*\d+\s*)?seconds?/i, fn: (m: RegExpMatchArray) => Math.ceil(parseInt(m[1]) / 60) },
    { re: /(\d+)\s*(?:to\s*\d+\s*)?hours?/i, fn: (m: RegExpMatchArray) => parseInt(m[1]) * 60 },
  ]
  for (const { re, fn } of patterns) {
    const match = step.match(re)
    if (match) {
      const mins = fn(match)
      if (mins >= 1 && mins <= 120) return mins
    }
  }
  return null
}

export function CookingModeClient({ recipe }: Props) {
  const recipeData = recipe.recipeData as RecipeData
  const steps = recipeData.steps ?? []
  const ingredients = recipeData.ingredients ?? []

  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [showIngredients, setShowIngredients] = useState(false)
  // Timer state
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerElapsed, setTimerElapsed] = useState(0)
  const [wakeLockSupported, setWakeLockSupported] = useState(false)
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const totalTime = (recipe.prepTimeMin || 0) + (recipe.cookTimeMin || 0)
  const progress = steps.length > 0 ? ((currentStep + 1) / steps.length) * 100 : 0

  // Screen wake lock — keeps display on while cooking
  useEffect(() => {
    setWakeLockSupported('wakeLock' in navigator)
  }, [])

  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen')
      setWakeLockActive(true)
      wakeLockRef.current.addEventListener('release', () => setWakeLockActive(false))
    } catch {
      // Wake lock denied — not critical, cooking mode still works
    }
  }, [])

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release()
      wakeLockRef.current = null
      setWakeLockActive(false)
    }
  }, [])

  // Auto-acquire wake lock on mount, release on unmount
  useEffect(() => {
    acquireWakeLock()
    return () => releaseWakeLock()
  }, [acquireWakeLock, releaseWakeLock])

  // Re-acquire wake lock if page becomes visible again (e.g. tab switch)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        acquireWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [acquireWakeLock])

  // Timer countdown logic
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerElapsed(prev => {
          const next = prev + 1
          if (timerSeconds !== null && next >= timerSeconds * 60) {
            // Timer done
            setTimerRunning(false)
            clearInterval(timerRef.current!)
          }
          return next
        })
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [timerRunning, timerSeconds])

  // Reset timer when step changes
  useEffect(() => {
    setTimerRunning(false)
    setTimerElapsed(0)
    const inferred = inferTimer(steps[currentStep] ?? '')
    setTimerSeconds(inferred)
  }, [currentStep, steps])

  const markComplete = () => {
    setCompletedSteps(prev => {
      const next = new Set(prev)
      next.add(currentStep)
      return next
    })
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const goNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep(prev => prev + 1)
  }

  const goPrev = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1)
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext() }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev() }
    if (e.key === 'Enter') { e.preventDefault(); markComplete() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const timerRemaining = timerSeconds !== null ? timerSeconds * 60 - timerElapsed : 0
  const timerMins = Math.floor(Math.max(0, timerRemaining) / 60)
  const timerSecs = Math.max(0, timerRemaining) % 60
  const timerDone = timerSeconds !== null && timerElapsed >= timerSeconds * 60

  const isDone = currentStep === steps.length - 1 && completedSteps.has(currentStep)

  return (
    <div className="min-h-screen bg-background flex flex-col select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <Link
          href={`/recipe/${recipe.id}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1 -ml-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
          Exit
        </Link>

        <div className="flex items-center gap-2">
          {recipe.cuisine && <Badge variant="secondary" className="text-xs hidden sm:inline-flex">{recipe.cuisine}</Badge>}
          {totalTime > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {totalTime}m
            </span>
          )}
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" />
            {recipe.servings}
          </span>
          {/* Wake lock indicator */}
          {wakeLockSupported && (
            <span
              title={wakeLockActive ? 'Screen will stay on' : 'Screen may sleep — tap to keep on'}
              className={cn(
                'text-xs flex items-center gap-1 cursor-default',
                wakeLockActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {wakeLockActive ? <Flame className="h-3 w-3" /> : <BatteryWarning className="h-3 w-3" />}
              <span className="hidden sm:inline">{wakeLockActive ? 'Screen on' : 'Screen may sleep'}</span>
            </span>
          )}
        </div>

        <button
          onClick={() => setShowIngredients(prev => !prev)}
          className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
        >
          {showIngredients ? 'Hide' : 'Ingredients'}
        </button>
      </div>

      {/* Progress bar */}
      <Progress value={progress} className="h-1 rounded-none" />

      {/* Ingredients overlay */}
      {showIngredients && (
        <div className="border-b border-border bg-muted/40 px-4 py-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Ingredients</h2>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {ingredients.map((ing, i) => (
              <li key={i} className="text-sm text-foreground flex gap-2">
                <span className="text-primary font-medium w-16 shrink-0 text-right">{ing.amount} {ing.unit}</span>
                <span>{ing.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-2xl mx-auto w-full">
        {/* Step counter */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm text-muted-foreground">
            Step {currentStep + 1} of {steps.length}
          </span>
          {completedSteps.has(currentStep) && (
            <Badge variant="secondary" className="gap-1 text-xs bg-primary/10 text-primary border-primary/20">
              <Check className="h-3 w-3" />
              Done
            </Badge>
          )}
        </div>

        {/* Step mini-nav dots */}
        <div className="flex gap-1.5 mb-8 flex-wrap justify-center max-w-xs">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
              aria-label={`Go to step ${i + 1}`}
              className={cn(
                'h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                i === currentStep
                  ? 'w-6 bg-primary'
                  : completedSteps.has(i)
                  ? 'w-2 bg-primary/40'
                  : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50',
              )}
            />
          ))}
        </div>

        {/* Step text — large, optimized for glancing while hands are busy */}
        {isDone ? (
          <div className="text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl font-bold text-foreground">Recipe complete!</h2>
            <p className="text-muted-foreground">Enjoy your {recipe.title}.</p>
            <div className="flex gap-3 justify-center pt-2">
              <Button asChild variant="outline">
                <Link href={`/recipe/${recipe.id}`}>View Recipe</Link>
              </Button>
              <Button asChild>
                <Link href="/kitchen">Cook Again</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-2xl sm:text-3xl font-medium text-foreground text-center leading-relaxed text-balance mb-8">
              {steps[currentStep]}
            </p>

            {/* Timer (auto-detected from step text) */}
            {timerSeconds !== null && (
              <div className={cn(
                'rounded-2xl border px-6 py-4 mb-8 text-center min-w-48 transition-colors',
                timerDone
                  ? 'border-primary bg-primary/10'
                  : timerRunning
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border bg-card',
              )}>
                <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1.5">
                  <Timer className="h-3 w-3" />
                  {timerDone ? 'Time\'s up!' : 'Suggested timer'}
                </p>
                <p className={cn(
                  'text-4xl font-mono font-bold tabular-nums',
                  timerDone ? 'text-primary' : 'text-foreground',
                )}>
                  {timerDone ? '0:00' : `${timerMins}:${String(timerSecs).padStart(2, '0')}`}
                </p>
                <div className="flex gap-2 justify-center mt-3">
                  {!timerDone && (
                    <Button
                      size="sm"
                      variant={timerRunning ? 'outline' : 'default'}
                      onClick={() => setTimerRunning(r => !r)}
                      className="h-8 text-xs px-4"
                    >
                      {timerRunning ? 'Pause' : timerElapsed > 0 ? 'Resume' : 'Start'}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setTimerRunning(false); setTimerElapsed(0) }}
                    className="h-8 text-xs px-3 text-muted-foreground"
                  >
                    Reset
                  </Button>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center gap-4 w-full max-w-sm">
              <Button
                variant="outline"
                size="lg"
                onClick={goPrev}
                disabled={currentStep === 0}
                className="flex-1 gap-2"
                aria-label="Previous step"
              >
                <ChevronLeft className="h-5 w-5" />
                Prev
              </Button>

              <Button
                size="lg"
                onClick={markComplete}
                className="flex-1 gap-2"
                aria-label={currentStep === steps.length - 1 ? 'Finish recipe' : 'Next step'}
              >
                {currentStep === steps.length - 1 ? (
                  <>
                    <Check className="h-5 w-5" />
                    Finish
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-5 w-5" />
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-4 text-center">
              Arrow keys to navigate · Space/Enter to advance
            </p>
          </>
        )}
      </div>
    </div>
  )
}
