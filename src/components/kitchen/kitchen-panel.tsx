'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { X, ChefHat, Upload, Camera, Loader2, Sparkles, RefreshCw } from 'lucide-react'
import { RecipeSuggestionCard, type RecipeSuggestion } from './recipe-suggestion-card'
import { UsageCounter } from './usage-counter'
import { cn } from '@/lib/utils'

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const generateRecipes = useCallback(async () => {
    if (ingredients.length < 2 || isGenerating) return
    setIsGenerating(true)
    setSuggestions([])
    setError(null)

    try {
      const res = await fetch('/api/recipes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients,
          cuisine: cuisine === 'any' ? undefined : cuisine,
          dietary: dietary === 'any' ? [] : [dietary],
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
  }, [ingredients, cuisine, dietary, isGenerating])

  // Auto-generate after 600ms debounce when ≥2 ingredients
  useEffect(() => {
    if (ingredients.length < 2) return
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
        body: JSON.stringify({ suggestion, ingredients }),
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
    if (ingredients.length < 2 || isGenerating) return
    generateRecipes()
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
            {/* Input */}
            <div>
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. chicken, rice, garlic..."
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">Press Enter or comma to add</p>
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
          <Button
            onClick={generateRecipes}
            disabled={ingredients.length < 2 || isGenerating}
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

          {/* F24: Try Again — only visible after suggestions load */}
          {suggestions.length > 0 && !isGenerating && (
            <Button
              variant="outline"
              onClick={handleTryAgain}
              disabled={ingredients.length < 2 || isGenerating}
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

        {!isGenerating && suggestions.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <ChefHat className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Add your ingredients</h2>
            <p className="text-muted-foreground max-w-xs">
              Type at least 2 ingredients on the left (or snap a photo) and IngredientBot will suggest personalized recipes.
            </p>
          </div>
        )}

        {isGenerating && suggestions.length === 0 && (
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
                    disabled={isGenerating}
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
