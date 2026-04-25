'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, Users, ArrowRight, Loader2, Flame } from 'lucide-react'

export interface RecipeSuggestion {
  title: string
  description: string
  prepMin?: number
  cookMin?: number
  servings?: number
  cuisine?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  kcal?: number
}

interface Props {
  suggestion: RecipeSuggestion
  onCook: () => void
  isCooking: boolean
}

const difficultyColor = {
  easy:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  hard:   'bg-red-100   text-red-700   dark:bg-red-900/30   dark:text-red-400',
}

export function RecipeSuggestionCard({ suggestion, onCook, isCooking }: Props) {
  const totalMin = (suggestion.prepMin || 0) + (suggestion.cookMin || 0)

  return (
    <div className="group rounded-xl bg-card ring-1 ring-foreground/10 p-5 transition-all duration-200 hover:shadow-md hover:ring-primary/30 flex flex-col">
      <h3 className="font-semibold text-foreground text-base leading-tight mb-1.5">
        {suggestion.title}
      </h3>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed line-clamp-2 flex-1">
        {suggestion.description}
      </p>

      {/* Meta row: badges + time/servings/kcal */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {suggestion.cuisine && (
          <Badge variant="secondary" className="text-xs">
            {suggestion.cuisine}
          </Badge>
        )}
        {suggestion.difficulty && (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${difficultyColor[suggestion.difficulty]}`}>
            {suggestion.difficulty}
          </span>
        )}
        {totalMin > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {totalMin}m
          </span>
        )}
        {suggestion.servings && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            {suggestion.servings}
          </span>
        )}
        {suggestion.kcal && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Flame className="h-3 w-3" />
            {suggestion.kcal} kcal
          </span>
        )}
      </div>

      <Button
        size="sm"
        className="w-full"
        onClick={onCook}
        disabled={isCooking}
      >
        {isCooking ? (
          <>
            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            Preparing…
          </>
        ) : (
          <>
            Cook this
            <ArrowRight className="h-3.5 w-3.5 ml-2" />
          </>
        )}
      </Button>
    </div>
  )
}
