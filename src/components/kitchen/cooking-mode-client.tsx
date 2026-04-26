'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  ChefHat,
  Pause,
  Play,
  RotateCcw,
  FastForward,
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
    <div className="min-h-screen text-white select-none flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/25 text-primary">
            <ChefHat className="h-[18px] w-[18px]" />
          </div>
          <div>
            <div className="text-[11px] text-white/50 uppercase tracking-[0.08em] font-semibold leading-none mb-0.5">
              Cook Mode · Step {currentStep + 1} of {steps.length}
            </div>
            <div className="text-[14px] font-medium text-white/85 leading-none">{recipe.title}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Wake lock indicator */}
          {wakeLockSupported && (
            <span
              title={wakeLockActive ? 'Screen will stay on' : 'Screen may sleep'}
              className={cn(
                'text-xs flex items-center gap-1',
                wakeLockActive ? 'text-primary' : 'text-white/40',
              )}
            >
              {wakeLockActive ? <Flame className="h-3 w-3" /> : <BatteryWarning className="h-3 w-3" />}
            </span>
          )}
          {totalTime > 0 && (
            <span className="hidden sm:flex items-center gap-1 text-xs text-white/50">
              <Clock className="h-3 w-3" />
              {totalTime}m
            </span>
          )}
          <span className="hidden sm:flex items-center gap-1 text-xs text-white/50">
            <Users className="h-3 w-3" />
            {recipe.servings}
          </span>
          <Link
            href={`/recipe/${recipe.id}`}
            className="flex items-center gap-1.5 text-xs border border-white/20 text-white/70 hover:text-white hover:border-white/40 rounded-md px-3 py-1.5 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Exit cook mode
          </Link>
        </div>
      </div>

      {/* Segmented progress bar */}
      <div
        className="grid gap-2 px-6 pt-5 pb-1"
        style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}
      >
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentStep(i)}
            aria-label={`Go to step ${i + 1}`}
            className={cn(
              'h-1.5 rounded-full transition-colors duration-200',
              i <= currentStep ? 'bg-primary' : 'bg-white/15',
            )}
          />
        ))}
      </div>

      {/* Ingredients drawer */}
      {showIngredients && (
        <div className="border-b border-white/10 bg-white/4 px-6 py-4">
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Ingredients</h2>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {ingredients.map((ing, i) => (
              <li key={i} className="text-sm text-white/80 flex gap-2">
                <span className="text-primary font-medium w-16 shrink-0 text-right">{ing.amount} {ing.unit}</span>
                <span>{ing.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 max-w-3xl mx-auto w-full">
        {isDone ? (
          <div className="text-center space-y-5">
            <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
              <Check className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-4xl font-bold text-white">Recipe complete!</h2>
            <p className="text-white/60 text-lg">Enjoy your {recipe.title}.</p>
            <div className="flex gap-3 justify-center pt-2">
              <Button asChild variant="outline" className="border-white/20 text-white bg-transparent hover:bg-white/10">
                <Link href={`/recipe/${recipe.id}`}>View Recipe</Link>
              </Button>
              <Button asChild>
                <Link href="/kitchen">Cook Again</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Step label */}
            {timerSeconds && (
              <div className="text-xs font-bold uppercase tracking-[0.1em] text-accent mb-3">
                Step {currentStep + 1} · {timerSeconds} minutes
              </div>
            )}

            {/* Step text — large, optimized for glancing while hands are busy */}
            <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-white text-center leading-[1.1] tracking-tight text-balance mb-8 max-w-2xl">
              {steps[currentStep]}
            </p>

            {/* Timer widget */}
            {timerSeconds !== null && (
              <div className={cn(
                'flex items-center gap-6 rounded-2xl border px-8 py-6 mb-8',
                timerDone
                  ? 'border-primary/60 bg-primary/15'
                  : timerRunning
                  ? 'border-primary/30 bg-white/5'
                  : 'border-white/10 bg-white/4',
              )}>
                <div>
                  <div className="text-[11px] text-white/50 uppercase tracking-wider mb-1.5">Timer</div>
                  <div className={cn(
                    'text-5xl font-bold tabular-nums tracking-tighter leading-none',
                    timerDone ? 'text-primary' : 'text-white',
                  )}>
                    {timerDone ? '0:00' : `${timerMins}:${String(timerSecs).padStart(2, '0')}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setTimerRunning(false); setTimerElapsed(0) }}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-colors"
                    aria-label="Reset timer"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  {!timerDone && (
                    <button
                      onClick={() => setTimerRunning(r => !r)}
                      className="flex h-14 w-14 items-center justify-center rounded-full bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
                      aria-label={timerRunning ? 'Pause timer' : 'Start timer'}
                    >
                      {timerRunning
                        ? <Pause className="h-5 w-5" />
                        : <Play className="h-5 w-5 ml-0.5" />
                      }
                    </button>
                  )}
                  <button
                    onClick={goNext}
                    disabled={currentStep === steps.length - 1}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-colors disabled:opacity-30"
                    aria-label="Skip step"
                  >
                    <FastForward className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={goPrev}
                disabled={currentStep === 0}
                className="border-white/20 text-white/80 bg-transparent hover:bg-white/10 hover:text-white gap-2"
                aria-label="Previous step"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              <Button
                onClick={markComplete}
                className="gap-2"
                aria-label={currentStep === steps.length - 1 ? 'Finish recipe' : 'Next step'}
              >
                {currentStep === steps.length - 1 ? (
                  <>
                    <Check className="h-4 w-4" />
                    Finish
                  </>
                ) : (
                  <>
                    Mark done · next step
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <button
                onClick={() => setShowIngredients(v => !v)}
                className="flex items-center gap-1.5 text-sm border border-white/20 text-white/70 hover:text-white hover:border-white/40 rounded-md px-3 py-2 transition-colors"
              >
                {showIngredients ? 'Hide' : 'Ingredients'}
              </button>
            </div>

            <p className="text-xs text-white/30 mt-5 text-center">
              Arrow keys to navigate · Space/Enter to advance
            </p>

            {/* Step dots */}
            <div className="flex gap-1.5 mt-6 flex-wrap justify-center max-w-xs">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  aria-label={`Go to step ${i + 1}`}
                  className={cn(
                    'h-1.5 rounded-full transition-all focus-visible:outline-none',
                    i === currentStep
                      ? 'w-6 bg-primary'
                      : completedSteps.has(i)
                      ? 'w-1.5 bg-primary/40'
                      : 'w-1.5 bg-white/20 hover:bg-white/40',
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
