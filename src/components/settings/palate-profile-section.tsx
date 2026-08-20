'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toaster'
import { Sparkles, Ban, Globe2, Loader2, RotateCcw } from 'lucide-react'

interface PalateData {
  lovedFlavors: string[]
  avoidedIngredients: string[]
  topCuisines: string[]
  computedAt: string | null
}

const EMPTY: PalateData = { lovedFlavors: [], avoidedIngredients: [], topCuisines: [], computedAt: null }

// F87: read-only — this profile is derived from cooking history (ratings,
// repeat-cooks, post-cook outcomes, ingredient swaps), never user-entered.
// Only action available is Reset, which clears it and forces a fresh
// recompute on the user's next recipe generation.
export function PalateProfileSection() {
  const { toast } = useToast()
  const [data, setData] = useState<PalateData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    fetch('/api/user/palate')
      .then((r) => r.json())
      .then((d) => setData({ ...EMPTY, ...d }))
      .finally(() => setLoading(false))
  }, [])

  const handleReset = async () => {
    setResetting(true)
    try {
      const res = await fetch('/api/user/palate', { method: 'DELETE' })
      if (!res.ok) {
        toast({ title: 'Could not reset palate profile', description: 'Please try again.', variant: 'destructive' })
        return
      }
      setData(EMPTY)
      toast({ title: 'Palate profile reset', description: "It'll be relearned from your next few recipes." })
    } catch {
      toast({ title: 'Could not reset palate profile', description: 'Please try again.', variant: 'destructive' })
    } finally {
      setResetting(false)
    }
  }

  const hasHistory = data.lovedFlavors.length > 0 || data.avoidedIngredients.length > 0 || data.topCuisines.length > 0

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-5" data-testid="palate-profile-card">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading palate profile…
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-5" data-testid="palate-profile-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Your Palate Profile</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Learned automatically from your ratings, repeat-cooked recipes, and cooking feedback —
            nothing here is something you set yourself.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={resetting || !hasHistory}
          data-testid="palate-reset"
          className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {resetting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1.5" />}
          Reset
        </Button>
      </div>

      {!hasHistory ? (
        <p className="text-sm text-muted-foreground italic" data-testid="palate-empty-state">
          Not enough cooking history yet — rate a few recipes or cook them again and we&apos;ll start
          learning what you like.
        </p>
      ) : (
        <div className="space-y-4">
          {data.topCuisines.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Globe2 className="h-4 w-4 text-muted-foreground" />
                Top Cuisines
              </h3>
              <div className="flex flex-wrap gap-2" data-testid="palate-top-cuisines">
                {data.topCuisines.map((c) => (
                  <Badge key={c} variant="secondary">{c}</Badge>
                ))}
              </div>
            </div>
          )}

          {data.lovedFlavors.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                Loved Flavors
              </h3>
              <div className="flex flex-wrap gap-2" data-testid="palate-loved-flavors">
                {data.lovedFlavors.map((f) => (
                  <Badge key={f} className="bg-primary text-primary-foreground border-primary">{f}</Badge>
                ))}
              </div>
            </div>
          )}

          {data.avoidedIngredients.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Ban className="h-4 w-4 text-muted-foreground" />
                Tends to Avoid
              </h3>
              <div className="flex flex-wrap gap-2" data-testid="palate-avoided-ingredients">
                {data.avoidedIngredients.map((i) => (
                  <Badge key={i} variant="destructive">{i}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
