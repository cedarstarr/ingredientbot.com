'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  X, ChefHat, Upload, Camera, Loader2, Sparkles, RefreshCw, Package, Timer,
  Mic, MicOff, Lock, BookOpen, DollarSign, UtensilsCrossed, Flame, Heart,
} from 'lucide-react'
import { RecipeSuggestionCard, type RecipeSuggestion } from './recipe-suggestion-card'
import { UsageCounter } from './usage-counter'
import { cn } from '@/lib/utils'

// F70: Chef personality options
type ChefPersonality = 'home' | 'french' | 'street'
const CHEF_PERSONALITIES: { id: ChefPersonality; label: string; Icon: React.ElementType; prompt: string }[] = [
  {
    id: 'home',
    label: 'Home Cook',
    Icon: UtensilsCrossed,
    prompt: 'You are a friendly home cook. Use accessible language, common ingredients, and practical tips.',
  },
  {
    id: 'french',
    label: 'French Chef',
    Icon: ChefHat,
    prompt: 'You are a classically trained French chef. Use precise culinary terminology, classical techniques, and emphasize proper method.',
  },
  {
    id: 'street',
    label: 'Street Food',
    Icon: Flame,
    prompt: 'You are a street food vendor. Emphasize bold flavors, quick cooking, cultural authenticity, and affordable ingredients.',
  },
]

// F32: Prep time filter options (null = no limit)
type PrepTime = 15 | 30 | 45 | 60 | null
const PREP_TIMES: { value: PrepTime; label: string }[] = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: null, label: 'No limit' },
]

interface PantryItem {
  id: string
  ingredient: string
  expiresAt: string | null
}

// F26: days until expiry (positive = future, negative = expired)
function daysUntilExpiry(expiresAt: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const exp = new Date(expiresAt)
  exp.setHours(0, 0, 0, 0)
  return Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function isExpiringSoon(item: PantryItem): boolean {
  if (!item.expiresAt) return false
  return daysUntilExpiry(item.expiresAt) <= 7
}

export function KitchenPanel() {
  const router = useRouter()
  const [ingredients, setIngredients] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<RecipeSuggestion[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [cuisine, setCuisine] = useState('any')
  const [dietary, setDietary] = useState('any')
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false)
  const [cookingId, setCookingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  // F30: track when a recipe is generated to refresh the usage counter
  const [usageRefreshKey, setUsageRefreshKey] = useState(0)
  // F30: whether user hit the monthly limit
  const [limitReached, setLimitReached] = useState(false)
  // F44: pantry items — loaded once, toggled per-session
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([])
  const [activePantryIds, setActivePantryIds] = useState<Set<string>>(new Set())
  // F26: expiry-first mode — elevate expiring items and tell AI to prioritize them
  const [expiryFirstMode, setExpiryFirstMode] = useState(false)
  // F28: leftover optimizer mode
  const [leftoverMode, setLeftoverMode] = useState(false)
  const [leftoverText, setLeftoverText] = useState('')
  // F61: strictness toggle — strict=only listed, lenient=assume pantry staples
  const [strictMode, setStrictMode] = useState(false)
  // F64: "Teach me" verbose recipe mode
  const [teachMode, setTeachMode] = useState(false)
  // F32: prep time filter
  const [prepTimeLimit, setPrepTimeLimit] = useState<PrepTime>(null)
  // F53: budget mode — persist to DB
  const [budgetMode, setBudgetMode] = useState(false)
  // F54: "Impress Me" mode — bypasses ingredient validation
  const [impressMeLoading, setImpressMeLoading] = useState(false)
  // F70: chef personality — persist to DB
  const [chefPersonality, setChefPersonality] = useState<ChefPersonality>('home')
  // F71: Date Night 3-course mode
  const [dateNightMode, setDateNightMode] = useState(false)
  // F55: voice input state
  const [isListening, setIsListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // F44: Load pantry items on mount
  useEffect(() => {
    fetch('/api/user/pantry')
      .then(r => r.ok ? r.json() : [])
      .then((items: PantryItem[]) => {
        setPantryItems(items)
        // Default: all pantry items active
        setActivePantryIds(new Set(items.map((i: PantryItem) => i.id)))
      })
      .catch(() => {})
  }, [])

  // F53 + F70: Load persisted kitchen preferences on mount
  useEffect(() => {
    fetch('/api/user/kitchen-prefs')
      .then(r => r.ok ? r.json() : null)
      .then((prefs: { budgetMode: boolean; chefPersonality: string } | null) => {
        if (!prefs) return
        setBudgetMode(prefs.budgetMode ?? false)
        if (['home', 'french', 'street'].includes(prefs.chefPersonality)) {
          setChefPersonality(prefs.chefPersonality as ChefPersonality)
        }
      })
      .catch(() => {})
  }, [])

  // F55: Check Web Speech API availability on mount (webkit prefix for Safari/older browsers)
  // Cast window to any to handle non-standard SpeechRecognition — not in default TS lib
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    if (!w.SpeechRecognition && !w.webkitSpeechRecognition) {
      setVoiceSupported(false)
    }
  }, [])

  // F55: Toggle voice recognition — appends transcribed text to input
  const toggleVoice = useCallback(() => {
    // Resolve the constructor — prefer standard, fall back to webkit prefix
    // Use any to avoid TS errors: SpeechRecognition not on Window in older lib versions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: any = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SR) return // graceful no-op; button already hidden when !voiceSupported

    if (isListening) {
      recognitionRef.current?.stop()
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SR()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript: string = e.results[0][0].transcript
      // Append transcribed text so users can speak multiple batches
      setInputValue(prev => prev ? `${prev}, ${transcript}` : transcript)
    }

    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isListening])

  const addIngredient = useCallback((value: string) => {
    const trimmed = value.trim().toLowerCase().replace(/,$/, '')
    if (!trimmed || ingredients.includes(trimmed)) return
    setIngredients(prev => [...prev, trimmed])
    setInputValue('')
  }, [ingredients])

  const removeIngredient = (ing: string) => {
    setIngredients(prev => prev.filter(i => i !== ing))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addIngredient(inputValue)
    }
  }

  // F44: Toggle a pantry item on/off for this session
  const togglePantryItem = (id: string) => {
    setActivePantryIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // F44: Merge typed ingredients with active pantry items, deduplicated
  // F26: when expiry-first mode is on, expiring items bubble to the top
  const allIngredients = useCallback(() => {
    const activePantry = pantryItems.filter(p => activePantryIds.has(p.id))

    // F26: sort — expiring items first when mode is enabled
    const sorted = expiryFirstMode
      ? [...activePantry].sort((a, b) => {
          const aExpiring = isExpiringSoon(a) ? 0 : 1
          const bExpiring = isExpiringSoon(b) ? 0 : 1
          return aExpiring - bExpiring
        })
      : activePantry

    const merged = [...ingredients]
    for (const p of sorted) {
      if (!merged.includes(p.ingredient)) merged.push(p.ingredient)
    }
    return merged
  }, [ingredients, pantryItems, activePantryIds, expiryFirstMode])

  // F26: list of expiring ingredient names for AI context
  const expiringIngredients = useCallback(() => {
    return pantryItems
      .filter(p => activePantryIds.has(p.id) && isExpiringSoon(p))
      .map(p => p.ingredient)
  }, [pantryItems, activePantryIds])

  const generateRecipes = useCallback(async () => {
    const combined = allIngredients()
    if (combined.length < 2 || isGenerating) return
    setIsGenerating(true)
    setSuggestions([])
    setError(null)

    try {
      // F26: pass expiring ingredients so the AI can prioritize them
      const expiring = expiryFirstMode ? expiringIngredients() : []

      const res = await fetch('/api/recipes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: combined,
          cuisine: cuisine === 'any' ? undefined : cuisine,
          dietary: dietary === 'any' ? [] : [dietary],
          expiringIngredients: expiring.length > 0 ? expiring : undefined,
          // F28: leftover mode
          leftovers: leftoverMode && leftoverText.trim() ? leftoverText.trim() : undefined,
          // F61: strictness mode
          strictMode,
          // F64: teach me mode
          teachMode,
          // F32: prep time constraint
          prepTimeLimit,
          // F53: budget mode
          budgetMode,
          // F70: chef personality
          chefPersonality,
          // F71: date night mode
          dateNightMode,
        }),
      })

      if (!res.ok) {
        setError('Failed to generate recipes. Please try again.')
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const parsed = JSON.parse(trimmed)
            if (parsed.title) {
              setSuggestions(prev => [...prev, parsed as RecipeSuggestion])
            }
          } catch {
            // Not a complete JSON line yet
          }
        }
      }

      // Try remaining buffer
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim())
          if (parsed.title) {
            setSuggestions(prev => [...prev, parsed as RecipeSuggestion])
          }
        } catch { /* ignore */ }
      }
    } catch (e) {
      setError('An error occurred. Please try again.')
      console.error(e)
    } finally {
      setIsGenerating(false)
    }
  }, [allIngredients, cuisine, dietary, isGenerating, leftoverMode, leftoverText, strictMode, teachMode, prepTimeLimit, budgetMode, chefPersonality, dateNightMode])

  // F54: "Impress Me" — bypass ingredient validation, AI chooses ingredients
  const handleImpressMe = useCallback(async () => {
    if (isGenerating || impressMeLoading) return
    setImpressMeLoading(true)
    setSuggestions([])
    setError(null)

    const personality = CHEF_PERSONALITIES.find(p => p.id === chefPersonality)

    try {
      const res = await fetch('/api/recipes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: ['[impress-me]'], // sentinel to bypass 2-ingredient guard
          impressMe: true,
          chefPersonality,
          budgetMode,
          prepTimeLimit,
          personalityPrompt: personality?.prompt,
        }),
      })

      if (!res.ok) {
        setError('Failed to generate recipes. Please try again.')
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const parsed = JSON.parse(trimmed)
            if (parsed.title) setSuggestions(prev => [...prev, parsed as RecipeSuggestion])
          } catch { /* incomplete line */ }
        }
      }
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim())
          if (parsed.title) setSuggestions(prev => [...prev, parsed as RecipeSuggestion])
        } catch { /* ignore */ }
      }
    } catch (e) {
      setError('An error occurred. Please try again.')
      console.error(e)
    } finally {
      setImpressMeLoading(false)
    }
  }, [isGenerating, impressMeLoading, chefPersonality, budgetMode, prepTimeLimit])

  // Auto-generate after 600ms debounce when ≥2 ingredients (typed or pantry)
  useEffect(() => {
    if (allIngredients().length < 2) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      generateRecipes()
    }, 600)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredients])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsAnalyzingPhoto(true)
    const formData = new FormData()
    formData.append('photo', file)

    try {
      const res = await fetch('/api/recipes/analyze-photo', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.ingredients && Array.isArray(data.ingredients)) {
        setIngredients(prev => {
          const newOnes = (data.ingredients as string[]).filter(
            (i: string) => !prev.includes(i.toLowerCase())
          )
          return [...prev, ...newOnes.map((i: string) => i.toLowerCase())]
        })
      }
    } catch {
      setError('Failed to analyze photo')
    } finally {
      setIsAnalyzingPhoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleCookThis = async (suggestion: RecipeSuggestion, index: number) => {
    setCookingId(index)
    setLimitReached(false)
    setError(null)
    try {
      const res = await fetch('/api/recipes/cook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // F44: pass merged ingredient list (typed + active pantry) to cook route
        // F28/F61/F64: pass active mode flags so cook route injects them into the full recipe generation prompt
        body: JSON.stringify({
          suggestion,
          ingredients: allIngredients(),
          leftovers: leftoverMode && leftoverText.trim() ? leftoverText.trim() : undefined,
          strictMode,
          teachMode,
          budgetMode,
          chefPersonality,
          dateNightMode,
        }),
      })

      // F30: 402 = freemium limit reached
      if (res.status === 402) {
        setLimitReached(true)
        setUsageRefreshKey(k => k + 1)
        return
      }

      const data = await res.json()
      if (data.id) {
        setUsageRefreshKey(k => k + 1)
        router.push(`/recipe/${data.id}`)
      } else {
        setError('Failed to generate recipe. Please try again.')
      }
    } catch {
      setError('Failed to generate recipe. Please try again.')
    } finally {
      setCookingId(null)
    }
  }

  // F24: Regenerate — same ingredients, new suggestions, explicit user action
  const handleTryAgain = () => {
    if (allIngredients().length < 2 || isGenerating) return
    generateRecipes()
  }

  // F53: Toggle budget mode and persist
  const toggleBudgetMode = () => {
    const next = !budgetMode
    setBudgetMode(next)
    fetch('/api/user/kitchen-prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budgetMode: next }),
    }).catch(() => {})
  }

  // F70: Change chef personality and persist
  const changeChefPersonality = (p: ChefPersonality) => {
    setChefPersonality(p)
    fetch('/api/user/kitchen-prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chefPersonality: p }),
    }).catch(() => {})
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="w-80 shrink-0 border-r border-border flex flex-col bg-card">
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            What&apos;s in your kitchen?
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Add 2+ ingredients to get recipe ideas</p>
        </div>

        <Tabs defaultValue="type" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-3 shrink-0">
            <TabsTrigger value="type" className="flex-1">Type</TabsTrigger>
            <TabsTrigger value="photo" className="flex-1">
              <Camera className="h-3.5 w-3.5 mr-1.5" />
              Photo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="type" className="flex-1 flex flex-col p-4 gap-3 overflow-auto">
            {/* Input + F55 voice mic */}
            <div>
              <div className="flex gap-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. chicken, rice, garlic..."
                  className="flex-1"
                />
                {/* F55: mic button — hidden when Web Speech API unsupported */}
                {voiceSupported && (
                  <button
                    type="button"
                    onClick={toggleVoice}
                    title={isListening ? 'Stop recording' : 'Speak ingredients'}
                    className={cn(
                      'h-9 w-9 flex items-center justify-center rounded-md border border-border transition-colors shrink-0',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isListening
                        ? 'bg-red-100 dark:bg-red-900/30 border-red-400/60 text-red-600 dark:text-red-400 animate-pulse'
                        : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:border-primary/40',
                    )}
                    aria-label={isListening ? 'Stop recording' : 'Start voice input'}
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isListening
                  ? 'Listening… speak your ingredients'
                  : 'Press Enter or comma to add'}
              </p>
            </div>

            {/* Tags */}
            {ingredients.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {ingredients.map(ing => (
                  <span
                    key={ing}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2.5 py-1 font-medium"
                  >
                    {ing}
                    <button
                      onClick={() => removeIngredient(ing)}
                      className="text-primary/60 hover:text-primary transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Filters */}
            <div className="space-y-2 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Cuisine</label>
                <Select value={cuisine} onValueChange={setCuisine}>
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Any cuisine" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any cuisine</SelectItem>
                    <SelectItem value="Italian">Italian</SelectItem>
                    <SelectItem value="Asian">Asian</SelectItem>
                    <SelectItem value="Mexican">Mexican</SelectItem>
                    <SelectItem value="Mediterranean">Mediterranean</SelectItem>
                    <SelectItem value="American">American</SelectItem>
                    <SelectItem value="Indian">Indian</SelectItem>
                    <SelectItem value="French">French</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Dietary restrictions</label>
                <Select value={dietary} onValueChange={setDietary}>
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="No dietary restrictions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">No restrictions</SelectItem>
                    <SelectItem value="vegetarian">Vegetarian</SelectItem>
                    <SelectItem value="vegan">Vegan</SelectItem>
                    <SelectItem value="gluten-free">Gluten-free</SelectItem>
                    <SelectItem value="dairy-free">Dairy-free</SelectItem>
                    <SelectItem value="low-carb">Low-carb</SelectItem>
                    <SelectItem value="keto">Keto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* F44: Pantry section — show active pantry items with toggle */}
            {pantryItems.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    Pantry
                  </span>
                  <Link
                    href="/pantry"
                    className="text-xs text-primary hover:underline focus-visible:outline-none"
                  >
                    Manage
                  </Link>
                </div>

                {/* F26: Expiry-first toggle — only shown when items have expiry dates */}
                {pantryItems.some(isExpiringSoon) && (
                  <button
                    type="button"
                    onClick={() => setExpiryFirstMode(v => !v)}
                    title="Prioritize expiring ingredients in recipe generation"
                    className={cn(
                      'w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      expiryFirstMode
                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400/60 text-amber-700 dark:text-amber-400 font-medium'
                        : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:border-amber-400/40',
                    )}
                  >
                    <Timer className="h-3 w-3 shrink-0" />
                    <span className="flex-1 text-left">Expiry-first mode</span>
                    {expiryFirstMode && (
                      <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                        ON
                      </span>
                    )}
                  </button>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {pantryItems.map(item => {
                    const active = activePantryIds.has(item.id)
                    const expiringSoon = isExpiringSoon(item)
                    const critical = item.expiresAt && daysUntilExpiry(item.expiresAt) <= 3
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => togglePantryItem(item.id)}
                        title={active ? 'Click to exclude from this session' : 'Click to include'}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full text-xs px-2 py-0.5 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          active
                            ? cn(
                                'bg-primary/15 text-primary border-primary/30',
                                critical && 'bg-red-100 dark:bg-red-900/30 border-red-400/50 text-red-700 dark:text-red-400',
                                !critical && expiringSoon && 'bg-amber-100 dark:bg-amber-900/30 border-amber-400/50 text-amber-700 dark:text-amber-400',
                              )
                            : 'bg-muted/40 text-muted-foreground border-border line-through'
                        )}
                      >
                        {critical && active && <span aria-hidden className="text-[10px]">🔴</span>}
                        {!critical && expiringSoon && active && <span aria-hidden className="text-[10px]">🟡</span>}
                        {item.ingredient}
                        {active && (
                          <X
                            className="h-2.5 w-2.5 opacity-60"
                            aria-label={`Exclude ${item.ingredient}`}
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* F32: Prep time filter */}
            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Timer className="h-3 w-3" />
                Time limit
              </span>
              <div className="flex flex-wrap gap-1">
                {PREP_TIMES.map(({ value, label }) => (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() => setPrepTimeLimit(value)}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      prepTimeLimit === value
                        ? 'bg-primary text-primary-foreground border-primary font-medium'
                        : 'bg-muted/30 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground',
                    )}
                    aria-pressed={prepTimeLimit === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {prepTimeLimit !== null && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  AI will target recipes completable in under {prepTimeLimit} min
                </p>
              )}
            </div>

            {/* F70: Chef personality */}
            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-medium text-muted-foreground">Chef style</span>
              <div className="flex gap-1.5">
                {CHEF_PERSONALITIES.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => changeChefPersonality(id)}
                    title={label}
                    aria-label={label}
                    aria-pressed={chefPersonality === id}
                    className={cn(
                      'flex-1 flex flex-col items-center gap-1 rounded-md py-2 px-1 border text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      chefPersonality === id
                        ? 'bg-primary/15 border-primary text-primary font-medium'
                        : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:border-primary/40',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="leading-none text-center">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* F28 / F53 / F61 / F64 / F71: Generation mode toggles */}
            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-medium text-muted-foreground">Generation modes</span>

              {/* F28: Leftover optimizer */}
              <button
                type="button"
                onClick={() => setLeftoverMode(v => !v)}
                title="Use leftover ingredients as star of the dish"
                className={cn(
                  'w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  leftoverMode
                    ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-400/60 text-orange-700 dark:text-orange-400 font-medium'
                    : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:border-orange-400/40',
                )}
              >
                <Package className="h-3 w-3 shrink-0" />
                <span className="flex-1 text-left">Leftover optimizer</span>
                {leftoverMode && (
                  <Badge className="bg-orange-500/20 text-orange-700 dark:text-orange-300 text-[10px] px-1.5 py-0 border-0">
                    ON
                  </Badge>
                )}
              </button>

              {/* F28: Leftover text input — only shown when mode active */}
              {leftoverMode && (
                <Textarea
                  value={leftoverText}
                  onChange={(e) => setLeftoverText(e.target.value)}
                  placeholder="e.g. roast chicken, half a bag of pasta, some leftover rice..."
                  className="text-xs resize-none h-16"
                  aria-label="Leftover ingredients to use up"
                />
              )}

              {/* F61: Strictness toggle */}
              <button
                type="button"
                onClick={() => setStrictMode(v => !v)}
                title="Only use the listed ingredients — no assumed pantry staples"
                className={cn(
                  'w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  strictMode
                    ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-400/60 text-purple-700 dark:text-purple-400 font-medium'
                    : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:border-purple-400/40',
                )}
              >
                <Lock className="h-3 w-3 shrink-0" />
                <span className="flex-1 text-left">Strict ingredients only</span>
                {strictMode && (
                  <Badge className="bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[10px] px-1.5 py-0 border-0">
                    ON
                  </Badge>
                )}
              </button>

              {/* F64: Teach me mode */}
              <button
                type="button"
                onClick={() => setTeachMode(v => !v)}
                title="Include explanations for each cooking step"
                className={cn(
                  'w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  teachMode
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400/60 text-blue-700 dark:text-blue-400 font-medium'
                    : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:border-blue-400/40',
                )}
              >
                <BookOpen className="h-3 w-3 shrink-0" />
                <span className="flex-1 text-left">Teach me mode</span>
                {teachMode && (
                  <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] px-1.5 py-0 border-0">
                    ON
                  </Badge>
                )}
              </button>

              {/* F53: Budget mode */}
              <button
                type="button"
                onClick={toggleBudgetMode}
                title="Prioritize cheap, pantry-staple ingredients"
                className={cn(
                  'w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  budgetMode
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-400/60 text-green-700 dark:text-green-400 font-medium'
                    : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:border-green-400/40',
                )}
              >
                <DollarSign className="h-3 w-3 shrink-0" />
                <span className="flex-1 text-left">Budget mode</span>
                {budgetMode && (
                  <Badge className="bg-green-500/20 text-green-700 dark:text-green-300 text-[10px] px-1.5 py-0 border-0">
                    ON
                  </Badge>
                )}
              </button>

              {/* F71: Date Night mode */}
              <button
                type="button"
                onClick={() => setDateNightMode(v => !v)}
                title="Generate a full 3-course date night menu"
                className={cn(
                  'w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  dateNightMode
                    ? 'bg-pink-50 dark:bg-pink-900/20 border-pink-400/60 text-pink-700 dark:text-pink-400 font-medium'
                    : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:border-pink-400/40',
                )}
              >
                <Heart className="h-3 w-3 shrink-0" />
                <span className="flex-1 text-left">Date Night (3-course)</span>
                {dateNightMode && (
                  <Badge className="bg-pink-500/20 text-pink-700 dark:text-pink-300 text-[10px] px-1.5 py-0 border-0">
                    ON
                  </Badge>
                )}
              </button>
            </div>

            {/* F30: Usage counter */}
            <UsageCounter refreshKey={usageRefreshKey} />
          </TabsContent>

          <TabsContent value="photo" className="flex-1 p-4">
            <div
              className="flex flex-col items-center justify-center h-48 rounded-xl border-2 border-dashed border-border hover:border-primary/40 cursor-pointer transition-colors bg-muted/30"
              onClick={() => fileInputRef.current?.click()}
            >
              {isAnalyzingPhoto ? (
                <>
                  <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
                  <p className="text-sm text-muted-foreground">Analyzing photo...</p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium text-foreground">Upload fridge photo</p>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP up to 5MB</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoUpload}
            />
            {ingredients.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {ingredients.map(ing => (
                  <span key={ing} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2.5 py-1">
                    {ing}
                    <button onClick={() => removeIngredient(ing)}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="p-4 border-t border-border shrink-0 space-y-2">
          {/* Active mode badges on the generate button */}
          {(prepTimeLimit !== null || budgetMode || dateNightMode) && (
            <div className="flex flex-wrap gap-1">
              {prepTimeLimit !== null && (
                <Badge variant="outline" className="text-[10px] py-0 border-amber-400/50 text-amber-700 dark:text-amber-400">
                  {prepTimeLimit}min limit
                </Badge>
              )}
              {budgetMode && (
                <Badge variant="outline" className="text-[10px] py-0 border-green-400/50 text-green-700 dark:text-green-400">
                  Budget Mode
                </Badge>
              )}
              {dateNightMode && (
                <Badge variant="outline" className="text-[10px] py-0 border-pink-400/50 text-pink-700 dark:text-pink-400">
                  Date Night
                </Badge>
              )}
            </div>
          )}

          <Button
            onClick={generateRecipes}
            disabled={allIngredients().length < 2 || isGenerating || impressMeLoading}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Finding recipes...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Find Recipes
              </>
            )}
          </Button>

          {/* F54: Impress Me — always visible; prominent when no ingredients, subtle otherwise */}
          <Button
            variant="outline"
            onClick={handleImpressMe}
            disabled={isGenerating || impressMeLoading}
            className="w-full gap-2 text-sm border-primary/40 text-primary hover:bg-primary/5"
          >
            {impressMeLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Impress Me
          </Button>

          {/* F24: Try Again — only visible after suggestions load */}
          {suggestions.length > 0 && !isGenerating && !impressMeLoading && (
            <Button
              variant="outline"
              onClick={handleTryAgain}
              disabled={allIngredients().length < 2 || isGenerating}
              className="w-full gap-2 text-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try Different Recipes
            </Button>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-auto p-6">
        {/* F30: Limit reached banner */}
        {limitReached && (
          <div className="mb-4 rounded-lg border border-amber-400/40 bg-amber-50 dark:bg-amber-900/10 px-4 py-3">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              You&apos;ve reached your 5 free recipes this month.
            </p>
            <Link
              href="/upgrade"
              className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline mt-1"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Upgrade to Pro for unlimited recipes
            </Link>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!isGenerating && !impressMeLoading && suggestions.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <ChefHat className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Add your ingredients</h2>
            <p className="text-muted-foreground max-w-xs">
              Type at least 2 ingredients on the left, or click &ldquo;Impress Me&rdquo; to let the AI choose.
            </p>
          </div>
        )}

        {(isGenerating || impressMeLoading) && suggestions.length === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            ))}
          </div>
        )}

        {suggestions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                Recipe Ideas
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  based on {ingredients.slice(0, 3).join(', ')}{ingredients.length > 3 ? '…' : ''}
                </span>
              </h2>
              <div className="flex items-center gap-2">
                {isGenerating && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {/* F24: Try Again in header (compact variant) */}
                {!isGenerating && (
                  <button
                    onClick={handleTryAgain}
                    disabled={isGenerating || allIngredients().length < 2}
                    title="Generate new recipe ideas from the same ingredients"
                    className={cn(
                      'flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors rounded-md px-2 py-1',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Try again
                  </button>
                )}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {suggestions.map((s, i) => (
                <RecipeSuggestionCard
                  key={i}
                  suggestion={s}
                  onCook={() => handleCookThis(s, i)}
                  isCooking={cookingId === i}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
