'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tag, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RecipeTagsProps {
  recipeId: string
  initialTags: string[]
}

// Auto-tag suggestions based on cuisine/protein/method — client-side
const SUGGESTIONS = [
  'chicken', 'beef', 'pork', 'fish', 'shrimp', 'tofu', 'eggs',
  'vegetarian', 'vegan', 'gluten-free', 'dairy-free',
  'quick', 'easy', 'meal-prep', 'freezer-friendly', 'one-pot',
  'baked', 'grilled', 'roasted', 'fried', 'steamed', 'slow-cooker',
  'breakfast', 'lunch', 'dinner', 'snack', 'dessert',
  'italian', 'asian', 'mexican', 'mediterranean', 'american', 'indian', 'french',
]

export function RecipeTags({ recipeId, initialTags }: RecipeTagsProps) {
  const [tags, setTags] = useState<string[]>(initialTags)
  const [input, setInput] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredSuggestions = input.length > 0
    ? SUGGESTIONS.filter(s => s.startsWith(input.toLowerCase()) && !tags.includes(s))
    : []

  const addTag = async (tag: string) => {
    const t = tag.trim().toLowerCase()
    if (!t || tags.includes(t)) { setInput(''); return }

    const next = [...tags, t]
    setTags(next)
    setInput('')
    await saveTags(next)
  }

  const removeTag = async (tag: string) => {
    const next = tags.filter(t => t !== tag)
    setTags(next)
    await saveTags(next)
  }

  const saveTags = async (next: string[]) => {
    setSaving(true)
    try {
      await fetch(`/api/recipes/${recipeId}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: next }),
      })
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    }
    if (e.key === 'Escape') {
      setInput('')
      setEditing(false)
    }
    if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

        {tags.map(tag => (
          <Badge
            key={tag}
            variant="secondary"
            className="text-xs gap-1 pr-1 group cursor-default"
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="rounded-full opacity-50 group-hover:opacity-100 transition-opacity hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        {!editing ? (
          <button
            onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0) }}
            className={cn(
              'inline-flex items-center gap-1 text-xs text-muted-foreground',
              'rounded-full border border-dashed border-border px-2 py-0.5',
              'hover:text-foreground hover:border-primary/40 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
            aria-label="Add tag"
          >
            <Plus className="h-3 w-3" />
            Add tag
          </button>
        ) : (
          <div className="relative">
            <Input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => { if (!input) setEditing(false) }}
              placeholder="type + enter"
              className="h-6 w-28 text-xs px-2 py-0"
              aria-label="New tag"
            />
            {/* Autocomplete suggestions */}
            {filteredSuggestions.length > 0 && (
              <div className="absolute top-full mt-1 z-20 bg-popover border border-border rounded-md shadow-md py-1 min-w-[120px]">
                {filteredSuggestions.slice(0, 6).map(s => (
                  <button
                    key={s}
                    onMouseDown={() => addTag(s)}
                    className="w-full text-left px-2 py-1 text-xs hover:bg-muted transition-colors text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {saving && (
          <span className="text-xs text-muted-foreground">saving…</span>
        )}
      </div>
    </div>
  )
}
