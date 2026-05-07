'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, RefreshCw, Info, Zap, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Substitution {
  name: string
  quantity: string
  flavorImpact: string
  textureImpact: string
  confidence: 'works_great' | 'works_ok' | 'last_resort'
  techniqueNote: string | null
}

interface SubstitutionResult {
  role: string
  substitutions: Substitution[]
  tip: string
}

export interface Ingredient {
  name: string
  amount: string
  unit: string
}

interface Props {
  recipeId: string
  ingredient: Ingredient | null
  onClose: () => void
  onSwap: (original: Ingredient, substitute: { name: string; quantity: string }) => void
}

const confidenceConfig = {
  works_great: {
    label: 'Works Great',
    icon: Zap,
    className: 'bg-[hsl(var(--color-success)/0.15)] text-[hsl(var(--color-success-fg))] border-[hsl(var(--color-success)/0.3)]',
  },
  works_ok: {
    label: 'Works OK',
    icon: Info,
    className: 'bg-[hsl(var(--color-warning)/0.15)] text-[hsl(var(--color-warning-fg))] border-[hsl(var(--color-warning)/0.3)]',
  },
  last_resort: {
    label: 'Last Resort',
    icon: AlertTriangle,
    className: 'bg-destructive/15 text-destructive border-destructive/30',
  },
}

export function SubstitutionPanel({ recipeId, ingredient, onClose, onSwap }: Props) {
  const [result, setResult] = useState<SubstitutionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [swappedIndex, setSwappedIndex] = useState<number | null>(null)

  const isOpen = ingredient !== null

  const fetchSubstitutions = async (ing: Ingredient) => {
    setLoading(true)
    setResult(null)
    setError(null)
    setSwappedIndex(null)

    try {
      const res = await fetch(`/api/recipes/${recipeId}/substitute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missingIngredient: ing.name }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Failed to get substitutions.')
        return
      }

      const data = await res.json()
      setResult(data)
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Fetch whenever a new ingredient is opened
  useEffect(() => {
    if (ingredient) {
      fetchSubstitutions(ingredient)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredient?.name])

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose()
      // Reset state after close animation settles
      setTimeout(() => {
        setResult(null)
        setError(null)
        setLoading(false)
        setSwappedIndex(null)
      }, 200)
    }
  }

  const handleSwap = (sub: Substitution, index: number) => {
    if (!ingredient) return
    setSwappedIndex(index)
    onSwap(ingredient, { name: sub.name, quantity: sub.quantity })
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="text-muted-foreground font-normal">Missing</span>
            <span className="text-foreground font-semibold">{ingredient?.name}</span>
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing substitutions…</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 gap-1.5 text-xs"
              onClick={() => ingredient && fetchSubstitutions(ingredient)}
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </Button>
          </div>
        )}

        {result && (
          <div className="space-y-5">
            {/* Role explanation */}
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Role in this recipe
              </p>
              <p className="text-sm text-foreground leading-relaxed">{result.role}</p>
            </div>

            {/* Substitutions */}
            <div className="space-y-3">
              {result.substitutions.map((sub, i) => {
                const conf = confidenceConfig[sub.confidence] ?? confidenceConfig.works_ok
                const ConfIcon = conf.icon
                const isSwapped = swappedIndex === i

                return (
                  <div
                    key={i}
                    className={cn(
                      'rounded-xl border p-4 space-y-3 transition-colors',
                      isSwapped
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border bg-card',
                    )}
                  >
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground text-sm">{sub.name}</p>
                        <p className="text-xs text-primary font-medium mt-0.5">{sub.quantity}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn('text-xs shrink-0 gap-1', conf.className)}
                      >
                        <ConfIcon className="h-3 w-3" />
                        {conf.label}
                      </Badge>
                    </div>

                    {/* Impact details */}
                    <div className="space-y-1.5">
                      <div className="flex gap-2 text-xs">
                        <span className="text-muted-foreground font-medium w-14 shrink-0">Flavor</span>
                        <span className="text-foreground leading-relaxed">{sub.flavorImpact}</span>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <span className="text-muted-foreground font-medium w-14 shrink-0">Texture</span>
                        <span className="text-foreground leading-relaxed">{sub.textureImpact}</span>
                      </div>
                      {sub.techniqueNote && (
                        <div className="flex gap-2 text-xs">
                          <span className="text-muted-foreground font-medium w-14 shrink-0">Technique</span>
                          <span className="text-[hsl(var(--color-warning-fg))] leading-relaxed">
                            {sub.techniqueNote}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Quick swap button */}
                    <Button
                      variant={isSwapped ? 'default' : 'outline'}
                      size="sm"
                      className="w-full h-8 text-xs gap-1.5"
                      onClick={() => handleSwap(sub, i)}
                    >
                      <RefreshCw className="h-3 w-3" />
                      {isSwapped ? 'Swapped in recipe view' : 'Use this substitute'}
                    </Button>
                  </div>
                )
              })}
            </div>

            {/* Chef's tip */}
            {result.tip && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                <p className="text-xs font-medium text-primary mb-1">Chef&apos;s Tip</p>
                <p className="text-xs text-foreground leading-relaxed">{result.tip}</p>
              </div>
            )}

            {/* Retry for different suggestions */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-8 text-xs gap-1.5 text-muted-foreground"
              onClick={() => ingredient && fetchSubstitutions(ingredient)}
            >
              <RefreshCw className="h-3 w-3" />
              Get different suggestions
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
