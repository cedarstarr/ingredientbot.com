'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ChefHat, Check, Loader2, ThumbsUp, Meh, ThumbsDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toaster'

type Outcome = 'great' | 'okay' | 'failed'

interface CookedThisButtonProps {
  recipeId: string
  initialCookedCount: number
  initialLastCookedAt?: Date | string | null
  // F88: bubbles the AI "next time..." tip up so the parent can pin it on the
  // recipe view without a second fetch — the tip already came back on this response.
  onTipReceived?: (tip: string) => void
}

export function CookedThisButton({ recipeId, initialCookedCount, initialLastCookedAt, onTipReceived }: CookedThisButtonProps) {
  const [cookedCount, setCookedCount] = useState(initialCookedCount)
  const [lastCookedAt, setLastCookedAt] = useState<Date | null>(
    initialLastCookedAt ? new Date(initialLastCookedAt) : null,
  )
  const [loading, setLoading] = useState(false)
  const [justCooked, setJustCooked] = useState(false)
  const { toast } = useToast()

  // F88: post-cook outcome prompt state
  const [completionId, setCompletionId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [submittingOutcome, setSubmittingOutcome] = useState<Outcome | null>(null)
  const [feedbackDone, setFeedbackDone] = useState(false)
  const [feedbackDismissed, setFeedbackDismissed] = useState(false)

  const handleCook = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/recipes/${recipeId}/cook`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setCookedCount(data.cookedCount)
        setLastCookedAt(new Date(data.lastCookedAt))
        setJustCooked(true)
        setCompletionId(data.completionId ?? null)
        setFeedbackDone(false)
        setFeedbackDismissed(false)
        setNote('')
        // Reset the "just cooked" indicator after 3s — the outcome prompt below stays.
        setTimeout(() => setJustCooked(false), 3000)
      } else {
        toast({ title: 'Could not log cook', description: 'Please try again.', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Could not log cook', description: 'Please try again.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const submitOutcome = async (outcome: Outcome) => {
    if (!completionId) return
    setSubmittingOutcome(outcome)
    try {
      const res = await fetch(`/api/recipes/${recipeId}/cook-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completionId, outcome, note }),
      })
      if (res.ok) {
        const data = await res.json()
        setFeedbackDone(true)
        if (data.aiTip) onTipReceived?.(data.aiTip)
      } else {
        toast({ title: 'Could not save feedback', description: 'Please try again.', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Could not save feedback', description: 'Please try again.', variant: 'destructive' })
    } finally {
      setSubmittingOutcome(null)
    }
  }

  const formatLastCooked = (date: Date) => {
    const diff = Date.now() - date.getTime()
    const days = Math.floor(diff / 86_400_000)
    if (days === 0) return 'today'
    if (days === 1) return 'yesterday'
    if (days < 7) return `${days} days ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  // Prompt shows once per cook, until answered or dismissed — it never blocks
  // the rest of the page, it's just an inline strip under the button.
  const showPrompt = Boolean(completionId) && !feedbackDone && !feedbackDismissed

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button
          variant={justCooked ? 'default' : 'outline'}
          size="sm"
          onClick={handleCook}
          disabled={loading}
          data-testid="cooked-this-button"
          className={cn(
            'gap-2 transition-all',
            justCooked && 'bg-[hsl(var(--color-success))] hover:bg-[hsl(var(--color-success)/0.9)] border-[hsl(var(--color-success))] text-white',
          )}
          aria-label="Mark recipe as cooked"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : justCooked ? (
            <Check className="h-4 w-4" />
          ) : (
            <ChefHat className="h-4 w-4" />
          )}
          {justCooked ? 'Cooked!' : 'Cooked this'}
        </Button>

        {cookedCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {cookedCount}× cooked
            {lastCookedAt && ` · last ${formatLastCooked(lastCookedAt)}`}
          </span>
        )}
      </div>

      {showPrompt && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 max-w-sm dark:bg-muted/10">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">How did it go?</p>
            <button
              type="button"
              onClick={() => setFeedbackDismissed(true)}
              aria-label="Dismiss outcome prompt"
              className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex gap-1.5 mt-2">
            <Button
              variant="outline"
              size="sm"
              data-testid="cook-outcome-great"
              onClick={() => submitOutcome('great')}
              disabled={submittingOutcome !== null}
              className="gap-1.5 flex-1"
            >
              {submittingOutcome === 'great' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
              Great
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="cook-outcome-okay"
              onClick={() => submitOutcome('okay')}
              disabled={submittingOutcome !== null}
              className="gap-1.5 flex-1"
            >
              {submittingOutcome === 'okay' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Meh className="h-3.5 w-3.5" />}
              Okay
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="cook-outcome-failed"
              onClick={() => submitOutcome('failed')}
              disabled={submittingOutcome !== null}
              className="gap-1.5 flex-1"
            >
              {submittingOutcome === 'failed' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsDown className="h-3.5 w-3.5" />}
              Failed
            </Button>
          </div>

          {/* Optional note — filled in before tapping an outcome above, so one tap submits both together. */}
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional)…"
            maxLength={1000}
            className="mt-2 min-h-14 text-xs"
            aria-label="Optional note about how the recipe went"
          />
        </div>
      )}

      {feedbackDone && !feedbackDismissed && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Check className="h-3 w-3 text-[hsl(var(--color-success))]" />
          Thanks — noted for next time.
        </p>
      )}
    </div>
  )
}
