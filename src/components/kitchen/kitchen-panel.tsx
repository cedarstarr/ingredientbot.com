'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import {
  X, ChefHat, Camera, Loader2, Sparkles, RefreshCw, Package, Timer,
  Mic, MicOff, Lock, BookOpen, DollarSign, UtensilsCrossed, Flame, Heart,
  Bed, Dumbbell, Utensils, ArrowRight, ChevronDown, Zap,
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

// F74: Cooking method options — "any" keeps default AI freedom
const COOKING_METHODS = [
  'any',
  'Sheet Pan',
  'One-Pot',
  'Air Fryer',
  'Slow Cooker',
  'Instant Pot',
  'Microwave Only',
  'No Stove',
] as const
type CookingMethod = (typeof COOKING_METHODS)[number]

// F78: Spice level labels — index = value (0..3)
const SPICE_LABELS = ['Mild', 'Medium', 'Hot', 'Fire'] as const

interface PantryItem {
  id: string
  ingredient: string
  expiresAt: string | null
  addedAt?: string | null
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
  // F35: difficulty filter — beginner/intermediate/advanced
  const [difficulty, setDifficulty] = useState('any')
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
  // F74: Cooking method — persist to DB (equipment constraint)
  const [cookingMethod, setCookingMethod] = useState<CookingMethod>('any')
  // F75: "I'm exhausted" — session only (transient mood)
  const [exhaustedMode, setExhaustedMode] = useState(false)
  // F76: Protein-Max — session only
  const [proteinMax, setProteinMax] = useState(false)
  // F77: Restaurant recreation free-text — session only (different craving each time)
  const [restaurantStyle, setRestaurantStyle] = useState('')
  // F78: Spice level 0..3 — persist to DB
  const [spiceLevel, setSpiceLevel] = useState(0)
  // F55: voice input state
  const [isListening, setIsListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(true)
  // Advanced options collapsible panel
  const [showAdvanced, setShowAdvanced] = useState(false)
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

  // F53 + F70 + F74 + F78: Load persisted kitchen preferences on mount
  useEffect(() => {
    fetch('/api/user/kitchen-prefs')
      .then(r => r.ok ? r.json() : null)
      .then((prefs: {
        budgetMode: boolean
        chefPersonality: string
        cookingMethod?: string
        spiceLevel?: number
      } | null) => {
        if (!prefs) return
        setBudgetMode(prefs.budgetMode ?? false)
        if (['home', 'french', 'street'].includes(prefs.chefPersonality)) {
          setChefPersonality(prefs.chefPersonality as ChefPersonality)
        }
        // F74: only accept known cooking methods
        if (typeof prefs.cookingMethod === 'string' && (COOKING_METHODS as readonly string[]).includes(prefs.cookingMethod)) {
          setCookingMethod(prefs.cookingMethod as CookingMethod)
        }
        // F78: clamp spice to 0..3
        if (typeof prefs.spiceLevel === 'number') {
          setSpiceLevel(Math.max(0, Math.min(3, prefs.spiceLevel)))
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
          // F35: difficulty filter
          difficulty: difficulty === 'any' ? undefined : difficulty,
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
          // F74: cooking method
          cookingMethod,
          // F75: exhausted mode
          exhaustedMode,
          // F76: protein-max
          proteinMax,
          // F77: restaurant recreation (trim on client too — server re-trims)
          restaurantStyle: restaurantStyle.trim() || undefined,
          // F78: spice level (always sent; AI calibrates even at Mild)
          spiceLevel,
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
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }, [allIngredients, expiringIngredients, expiryFirstMode, cuisine, dietary, isGenerating, leftoverMode, leftoverText, strictMode, teachMode, prepTimeLimit, budgetMode, chefPersonality, dateNightMode, cookingMethod, exhaustedMode, proteinMax, restaurantStyle, spiceLevel, difficulty])

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
          // F74–F78: honor kitchen-panel modifiers even for Impress Me
          cookingMethod,
          exhaustedMode,
          proteinMax,
          restaurantStyle: restaurantStyle.trim() || undefined,
          spiceLevel,
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
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setImpressMeLoading(false)
    }
  }, [isGenerating, impressMeLoading, chefPersonality, budgetMode, prepTimeLimit, cookingMethod, exhaustedMode, proteinMax, restaurantStyle, spiceLevel])

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
          // F74–F78: mirror every modifier into the full recipe generation
          cookingMethod,
          exhaustedMode,
          proteinMax,
          restaurantStyle: restaurantStyle.trim() || undefined,
          spiceLevel,
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

  // F74: Change cooking method and persist
  const changeCookingMethod = (m: CookingMethod) => {
    setCookingMethod(m)
    fetch('/api/user/kitchen-prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookingMethod: m }),
    }).catch(() => {})
  }

  // F78: Change spice level and persist
  const changeSpiceLevel = (lvl: number) => {
    const clamped = Math.max(0, Math.min(3, Math.round(lvl)))
    setSpiceLevel(clamped)
    fetch('/api/user/kitchen-prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spiceLevel: clamped }),
    }).catch(() => {})
  }

  // Count how many advanced options are active
  const advancedActiveCount = [
    cuisine !== 'any',
    dietary !== 'any',
    difficulty !== 'any',
    cookingMethod !== 'any',
    budgetMode,
    leftoverMode,
    dateNightMode,
    prepTimeLimit !== null,
  ].filter(Boolean).length

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-[1080px] mx-auto px-10 py-8 pb-16 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-[30px] font-bold tracking-tight leading-[1.1] mb-1.5">What&apos;s in your fridge today?</h1>
          <p className="text-muted-foreground text-[15px]">Type, snap, or paste a list. I&apos;ll cook up 4 ideas in about 8 seconds.</p>
        </div>

        {/* Composer card */}
        <div className="rounded-xl bg-card ring-1 ring-foreground/10 p-5 space-y-3">
          <Textarea
            value={inputValue}
            onChange={(e) => {
              const text = e.target.value
              setInputValue(text)
              // Parse textarea into ingredients array
              const parsed = text.split(/[,\n]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
              setIngredients(parsed)
            }}
            placeholder="2 chicken thighs, broccoli, garlic, sesame oil, gochujang..."
            className="min-h-[80px] resize-none border-input focus-visible:ring-ring text-sm"
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* 4 primary mode toggles as pills */}
            <div className="flex gap-2 flex-wrap">
              {/* Strict mode */}
              <button
                type="button"
                onClick={() => setStrictMode(v => !v)}
                aria-pressed={strictMode}
                className={cn(
                  'inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[13px] font-medium cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  strictMode
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-background border-input text-foreground hover:bg-muted/60',
                )}
              >
                <Lock className="h-3.5 w-3.5" />
                Strict ingredients only
              </button>
              {/* Exhausted mode */}
              <button
                type="button"
                onClick={() => setExhaustedMode(v => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[13px] font-medium cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  exhaustedMode
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-background border-input text-foreground hover:bg-muted/60',
                )}
                aria-pressed={exhaustedMode}
              >
                <Bed className="h-3.5 w-3.5" />
                I&apos;m exhausted
              </button>
              {/* Protein-max */}
              <button
                type="button"
                onClick={() => setProteinMax(v => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[13px] font-medium cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  proteinMax
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-background border-input text-foreground hover:bg-muted/60',
                )}
                aria-pressed={proteinMax}
              >
                <Dumbbell className="h-3.5 w-3.5" />
                Protein-Max
              </button>
              {/* Teach me mode */}
              <button
                type="button"
                onClick={() => setTeachMode(v => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[13px] font-medium cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  teachMode
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-background border-input text-foreground hover:bg-muted/60',
                )}
                aria-pressed={teachMode}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Teach me mode
              </button>
            </div>
            {/* Action buttons */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isAnalyzingPhoto}>
                {isAnalyzingPhoto ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Camera className="h-4 w-4 mr-1.5" />}
                Snap fridge
              </Button>
              <Button size="sm" onClick={generateRecipes} disabled={allIngredients().length < 2 || isGenerating || impressMeLoading}>
                {isGenerating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                Find recipes
                {!isGenerating && <ArrowRight className="h-4 w-4 ml-1.5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Advanced options (collapsible) */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            aria-expanded={showAdvanced}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', showAdvanced && 'rotate-180')} />
            Advanced options
            {advancedActiveCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
                {advancedActiveCount}
              </span>
            )}
          </button>
          {showAdvanced && (
            <div className="mt-3 rounded-xl border border-border bg-card/50 p-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {/* F34: Cuisine selector */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Cuisine</label>
                  <Select value={cuisine} onValueChange={setCuisine}>
                    <SelectTrigger className="w-full text-sm">
                      <SelectValue placeholder="Any cuisine" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any cuisine</SelectItem>
                      <SelectItem value="Thai">Thai</SelectItem>
                      <SelectItem value="Italian">Italian</SelectItem>
                      <SelectItem value="Mexican">Mexican</SelectItem>
                      <SelectItem value="Japanese">Japanese</SelectItem>
                      <SelectItem value="Indian">Indian</SelectItem>
                      <SelectItem value="Mediterranean">Mediterranean</SelectItem>
                      <SelectItem value="French">French</SelectItem>
                      <SelectItem value="American">American</SelectItem>
                      <SelectItem value="Chinese">Chinese</SelectItem>
                      <SelectItem value="Korean">Korean</SelectItem>
                      <SelectItem value="Middle Eastern">Middle Eastern</SelectItem>
                      <SelectItem value="Greek">Greek</SelectItem>
                      <SelectItem value="Vietnamese">Vietnamese</SelectItem>
                      <SelectItem value="Spanish">Spanish</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Dietary restrictions */}
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

                {/* F35: Difficulty selector */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Difficulty</label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger className="w-full text-sm">
                      <SelectValue placeholder="Any difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any difficulty</SelectItem>
                      <SelectItem value="beginner">Beginner / Easy</SelectItem>
                      <SelectItem value="intermediate">Intermediate / Medium</SelectItem>
                      <SelectItem value="advanced">Advanced / Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* F74: Cooking method selector */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Utensils className="h-3 w-3" />
                    Cooking method
                  </label>
                  <Select value={cookingMethod} onValueChange={(v) => changeCookingMethod(v as CookingMethod)}>
                    <SelectTrigger className="w-full text-sm">
                      <SelectValue placeholder="Any method" />
                    </SelectTrigger>
                    <SelectContent>
                      {COOKING_METHODS.map(m => (
                        <SelectItem key={m} value={m}>
                          {m === 'any' ? 'Any method' : m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* F77: Restaurant recreation */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Recreate restaurant style</label>
                  <Input
                    value={restaurantStyle}
                    onChange={(e) => setRestaurantStyle(e.target.value)}
                    placeholder="Recreate like Chipotle, Olive Garden…"
                    className="text-sm"
                    maxLength={120}
                    aria-label="Recreate the flavor profile of a restaurant"
                  />
                </div>
              </div>

              {/* F78: Spice level slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Flame className="h-3 w-3" />
                    Spice level
                  </span>
                  <span className="text-[10px] font-medium text-primary">{SPICE_LABELS[spiceLevel]}</span>
                </div>
                <Slider
                  value={[spiceLevel]}
                  min={0}
                  max={3}
                  step={1}
                  onValueChange={(v) => changeSpiceLevel(v[0] ?? 0)}
                  aria-label="Spice level"
                  data-testid="spice-level-slider"
                  className="focus-visible:outline-none"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                  {SPICE_LABELS.map((label, i) => (
                    <span
                      key={label}
                      className={cn(
                        'transition-colors',
                        spiceLevel === i && 'text-foreground font-medium',
                      )}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* F70: Chef personality */}
              <div className="space-y-1.5">
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

              {/* Generation mode toggles */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Generation modes</span>
                <div className="grid grid-cols-2 gap-2">
                  {/* F28: Leftover optimizer */}
                  <button
                    type="button"
                    onClick={() => setLeftoverMode(v => !v)}
                    title="Use leftover ingredients as star of the dish"
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      leftoverMode
                        ? 'bg-[hsl(var(--cat-3-muted))] border-[hsl(var(--cat-3)/0.6)] text-[hsl(var(--cat-3-fg))] font-medium'
                        : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:border-[hsl(var(--cat-3)/0.4)]',
                    )}
                  >
                    <Package className="h-3 w-3 shrink-0" />
                    <span className="flex-1 text-left">Leftover optimizer</span>
                    {leftoverMode && (
                      <Badge className="bg-[hsl(var(--cat-3)/0.2)] text-[hsl(var(--cat-3-fg))] text-[10px] px-1.5 py-0 border-0">
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
                      'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      budgetMode
                        ? 'bg-[hsl(var(--color-success-muted))] border-[hsl(var(--color-success)/0.6)] text-[hsl(var(--color-success-fg))] font-medium'
                        : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:border-[hsl(var(--color-success)/0.4)]',
                    )}
                  >
                    <DollarSign className="h-3 w-3 shrink-0" />
                    <span className="flex-1 text-left">Budget mode</span>
                    {budgetMode && (
                      <Badge className="bg-[hsl(var(--color-success)/0.2)] text-[hsl(var(--color-success-fg))] text-[10px] px-1.5 py-0 border-0">
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
                      'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      dateNightMode
                        ? 'bg-[hsl(var(--cat-4-muted))] border-[hsl(var(--cat-4)/0.6)] text-[hsl(var(--cat-4-fg))] font-medium'
                        : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:border-[hsl(var(--cat-4)/0.4)]',
                    )}
                  >
                    <Heart className="h-3 w-3 shrink-0" />
                    <span className="flex-1 text-left">Date Night (3-course)</span>
                    {dateNightMode && (
                      <Badge className="bg-[hsl(var(--cat-4)/0.2)] text-[hsl(var(--cat-4-fg))] text-[10px] px-1.5 py-0 border-0">
                        ON
                      </Badge>
                    )}
                  </button>

                  {/* F26: Expiry-first mode — only when expiring items exist */}
                  {pantryItems.some(isExpiringSoon) && (
                    <button
                      type="button"
                      onClick={() => setExpiryFirstMode(v => !v)}
                      title="Prioritize expiring ingredients in recipe generation"
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        expiryFirstMode
                          ? 'bg-[hsl(var(--color-warning-muted))] border-[hsl(var(--color-warning)/0.6)] text-[hsl(var(--color-warning-fg))] font-medium'
                          : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:border-[hsl(var(--color-warning)/0.4)]',
                      )}
                    >
                      <Timer className="h-3 w-3 shrink-0" />
                      <span className="flex-1 text-left">Expiry-first mode</span>
                      {expiryFirstMode && (
                        <span className="rounded-full bg-[hsl(var(--color-warning)/0.2)] px-1.5 py-0.5 text-[10px] text-[hsl(var(--color-warning-fg))]">
                          ON
                        </span>
                      )}
                    </button>
                  )}
                </div>

                {/* F28: Leftover text input — only when mode active */}
                {leftoverMode && (
                  <Textarea
                    value={leftoverText}
                    onChange={(e) => setLeftoverText(e.target.value)}
                    placeholder="e.g. roast chicken, half a bag of pasta, some leftover rice..."
                    className="text-xs resize-none h-16 mt-2"
                    aria-label="Leftover ingredients to use up"
                  />
                )}
              </div>

              {/* F32: Prep time filter */}
              <div className="space-y-1.5">
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
                  <p className="text-[10px] text-[hsl(var(--color-warning-fg))]">
                    AI will target recipes completable in under {prepTimeLimit} min
                  </p>
                )}
              </div>

              {/* F44: Pantry section */}
              {pantryItems.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      Pantry
                    </span>
                    <Link
                      href="/pantry"
                      className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                    >
                      Manage
                    </Link>
                  </div>
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
                                  critical && 'bg-destructive/10 border-destructive/50 text-destructive',
                                  !critical && expiringSoon && 'bg-[hsl(var(--color-warning-muted))] border-[hsl(var(--color-warning)/0.5)] text-[hsl(var(--color-warning-fg))]',
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

              {/* F54: Impress Me */}
              <div className="pt-1">
                <Button
                  variant="outline"
                  onClick={handleImpressMe}
                  disabled={isGenerating || impressMeLoading}
                  className="gap-2 text-sm border-primary/40 text-primary hover:bg-primary/5"
                >
                  {impressMeLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Impress Me
                </Button>
              </div>

              {/* F30: Usage counter */}
              <UsageCounter refreshKey={usageRefreshKey} />

              {/* F55: Voice input (secondary feature) */}
              {voiceSupported && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={toggleVoice}
                    title={isListening ? 'Stop recording' : 'Speak ingredients'}
                    className={cn(
                      'inline-flex items-center gap-2 h-8 px-3 rounded-md border text-xs transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isListening
                        ? 'bg-destructive/10 border-destructive/60 text-destructive animate-pulse'
                        : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground hover:border-primary/40',
                    )}
                    aria-label={isListening ? 'Stop recording' : 'Start voice input'}
                  >
                    {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                    {isListening ? 'Listening… speak your ingredients' : 'Speak ingredients'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Limit reached banner */}
        {limitReached && (
          <div className="rounded-lg border border-[hsl(var(--color-warning)/0.4)] bg-[hsl(var(--color-warning-muted))] px-4 py-3">
            <p className="text-sm font-medium text-[hsl(var(--color-warning-fg))]">
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

        {/* Error banner */}
        {error && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!isGenerating && !impressMeLoading && suggestions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <ChefHat className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Add your ingredients</h2>
            <p className="text-muted-foreground max-w-xs">
              Type at least 2 ingredients above, snap a fridge photo, or click &ldquo;Impress Me&rdquo; in Advanced options to let the AI choose.
            </p>
          </div>
        )}

        {/* Skeleton loading state */}
        {(isGenerating || impressMeLoading) && suggestions.length === 0 && (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" />
                <div className="flex gap-2"><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-5 w-12 rounded-full" /></div>
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            ))}
          </div>
        )}

        {/* Recipe suggestions grid */}
        {suggestions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[18px] font-semibold tracking-tight">
                {suggestions.length} {suggestions.length === 1 ? 'idea' : 'ideas'} for tonight
              </h2>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Zap className="h-3 w-3" />
                  Generated · claude-sonnet-4-6
                </span>
                {!isGenerating && (
                  <button onClick={handleTryAgain} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" />Try again
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {suggestions.map((s, i) => (
                <RecipeSuggestionCard
                  key={i}
                  suggestion={s}
                  onCook={() => handleCookThis(s, i)}
                  isCooking={cookingId === i}
                  isPrimary={i === 0}
                />
              ))}
            </div>
          </div>
        )}

        {/* Pantry quick view — expiring soon items */}
        {pantryItems.length > 0 && pantryItems.some(i => i.expiresAt && daysUntilExpiry(i.expiresAt) <= 7) && (
          <div className="rounded-xl bg-card ring-1 ring-foreground/10 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[18px] font-semibold tracking-tight">Pantry · expiring soon</h2>
              <Link href="/pantry" className="text-[13px] text-primary hover:underline">
                View all {pantryItems.length} items →
              </Link>
            </div>
            {pantryItems
              .filter(i => i.expiresAt && daysUntilExpiry(i.expiresAt) <= 7)
              .slice(0, 5)
              .map(item => {
                const days = item.expiresAt ? daysUntilExpiry(item.expiresAt) : null
                const urgency = days !== null && days <= 1 ? 'danger' : days !== null && days <= 3 ? 'warning' : 'fresh'
                return (
                  <div key={item.id} className="grid grid-cols-[24px_1fr_auto_auto] gap-3 items-center py-2.5 border-b border-dashed border-border last:border-0">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/8 text-primary">
                      <Package className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <div className="text-sm font-medium capitalize">{item.ingredient}</div>
                      {item.addedAt && (
                        <div className="text-[11px] text-muted-foreground">
                          added {Math.round((Date.now() - new Date(item.addedAt).getTime()) / (1000 * 60 * 60 * 24))}d ago
                        </div>
                      )}
                    </div>
                    <span className={cn(
                      'text-[11px] px-2 py-0.5 rounded-full font-medium',
                      urgency === 'danger' ? 'bg-destructive/10 text-destructive' :
                      urgency === 'warning' ? 'bg-[hsl(var(--color-warning-muted))] text-[hsl(var(--color-warning-fg))]' :
                      'bg-[hsl(var(--color-success-muted))] text-[hsl(var(--color-success-fg))]',
                    )}>
                      {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setInputValue(prev => prev ? `${prev}, ${item.ingredient}` : item.ingredient)
                        setIngredients(prev => prev.includes(item.ingredient) ? prev : [...prev, item.ingredient])
                      }}
                    >
                      Use it
                    </Button>
                  </div>
                )
              })}
          </div>
        )}

      </div>

      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handlePhotoUpload}
      />
    </div>
  )
}
