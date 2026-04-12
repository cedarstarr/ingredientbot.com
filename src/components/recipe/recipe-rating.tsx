'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RecipeRatingProps {
  recipeId: string
  initialRating: number | null
}

export function RecipeRating({ recipeId, initialRating }: RecipeRatingProps) {
  const [rating, setRating] = useState<number | null>(initialRating)
  const [hovered, setHovered] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const handleRate = async (star: number) => {
    // Toggle off if clicking the current rating
    const newRating = rating === star ? null : star
    setSaving(true)
    try {
      await fetch(`/api/recipes/${recipeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: newRating }),
      })
      setRating(newRating)
    } finally {
      setSaving(false)
    }
  }

  const displayRating = hovered ?? rating

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Your rating:</span>
      <div
        className="flex items-center gap-0.5"
        onMouseLeave={() => setHovered(null)}
        aria-label="Rate this recipe"
      >
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHovered(star)}
            disabled={saving}
            aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
            className={cn(
              'p-0.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              saving ? 'opacity-50 pointer-events-none' : 'hover:scale-110',
            )}
          >
            <Star
              className={cn(
                'h-5 w-5 transition-colors',
                displayRating !== null && star <= displayRating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground/40',
              )}
            />
          </button>
        ))}
      </div>
      {rating !== null && (
        <span className="text-xs text-muted-foreground">{rating}/5</span>
      )}
    </div>
  )
}
