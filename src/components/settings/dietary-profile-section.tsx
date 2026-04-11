'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { X, Plus, Loader2, CheckCircle } from 'lucide-react'

const RESTRICTION_OPTIONS = [
  'vegan',
  'vegetarian',
  'gluten-free',
  'dairy-free',
  'nut-free',
  'egg-free',
  'soy-free',
  'low-carb',
  'keto',
  'paleo',
  'halal',
  'kosher',
]

const CUISINE_OPTIONS = [
  'Italian',
  'Asian',
  'Mexican',
  'Mediterranean',
  'American',
  'Indian',
  'French',
  'Thai',
  'Japanese',
  'Greek',
  'Middle Eastern',
  'Korean',
]

export function DietaryProfileSection() {
  const [restrictions, setRestrictions] = useState<string[]>([])
  const [cuisinePrefs, setCuisinePrefs] = useState<string[]>([])
  const [dislikedIngredients, setDislikedIngredients] = useState<string[]>([])
  const [dislikedInput, setDislikedInput] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/user/dietary')
      .then(r => r.json())
      .then(d => {
        if (d) {
          setRestrictions(d.restrictions ?? [])
          setCuisinePrefs(d.cuisinePrefs ?? [])
          setDislikedIngredients(d.dislikedIngredients ?? [])
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const toggleRestriction = (val: string) => {
    setRestrictions(prev =>
      prev.includes(val) ? prev.filter(r => r !== val) : [...prev, val]
    )
    setSaved(false)
  }

  const toggleCuisine = (val: string) => {
    setCuisinePrefs(prev =>
      prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val]
    )
    setSaved(false)
  }

  const addDisliked = () => {
    const trimmed = dislikedInput.trim().toLowerCase().replace(/,$/, '')
    if (!trimmed || dislikedIngredients.includes(trimmed)) {
      setDislikedInput('')
      return
    }
    setDislikedIngredients(prev => [...prev, trimmed])
    setDislikedInput('')
    setSaved(false)
  }

  const removeDisliked = (ing: string) => {
    setDislikedIngredients(prev => prev.filter(i => i !== ing))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await fetch('/api/user/dietary', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restrictions, cuisinePrefs, dislikedIngredients }),
      })
      setSaved(true)
      // clear confirmation after 3s
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading dietary profile...
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Dietary Profile</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          These preferences are automatically applied to every recipe you generate — no need to set them each time.
        </p>
      </div>

      {/* Dietary restrictions */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Dietary Restrictions</h3>
        <div className="flex flex-wrap gap-2">
          {RESTRICTION_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => toggleRestriction(opt)}
              className={[
                'rounded-full px-3 py-1 text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                restrictions.includes(opt)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
              ].join(' ')}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Cuisine preferences */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Favorite Cuisines</h3>
        <p className="text-xs text-muted-foreground">AI will favor these when no cuisine is selected in the kitchen.</p>
        <div className="flex flex-wrap gap-2">
          {CUISINE_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => toggleCuisine(opt)}
              className={[
                'rounded-full px-3 py-1 text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                cuisinePrefs.includes(opt)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
              ].join(' ')}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Disliked ingredients */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Disliked Ingredients</h3>
        <p className="text-xs text-muted-foreground">AI will avoid these in every recipe it generates for you.</p>
        <div className="flex gap-2">
          <Input
            value={dislikedInput}
            onChange={e => setDislikedInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addDisliked()
              }
            }}
            placeholder="e.g. cilantro, anchovies..."
            className="flex-1"
          />
          <Button type="button" variant="outline" size="icon" onClick={addDisliked}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {dislikedIngredients.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {dislikedIngredients.map(ing => (
              <Badge key={ing} variant="secondary" className="gap-1 pr-1">
                {ing}
                <button
                  type="button"
                  onClick={() => removeDisliked(ing)}
                  className="rounded hover:text-destructive transition-colors"
                  aria-label={`Remove ${ing}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Preferences'
          )}
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            Saved!
          </span>
        )}
      </div>
    </div>
  )
}
