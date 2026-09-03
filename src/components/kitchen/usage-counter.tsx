'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface UsageData {
  isPro: boolean
  used: number
  /** null when no cap is in force — see src/lib/limits.ts. */
  limit: number | null
  remaining: number | null
}

/**
 * Only surface the counter inside this many recipes of the ceiling. Above it,
 * the cap is irrelevant to the person cooking.
 */
const SHOW_WHEN_REMAINING_AT_MOST = 10

interface Props {
  /** Called after a recipe is generated so we can refresh the count */
  refreshKey?: number
}

export function UsageCounter({ refreshKey }: Props) {
  const [usage, setUsage] = useState<UsageData | null>(null)

  useEffect(() => {
    fetch('/api/user/usage')
      .then(r => r.json())
      .then(setUsage)
      .catch(() => null)
  }, [refreshKey])

  // Nothing to show without a cap: "3 recipes used" with no ceiling is a
  // meaningless progress bar, and "2 left" would be a lie.
  if (!usage || usage.isPro || usage.limit === null || usage.remaining === null) return null

  // The cap is an abuse ceiling, not a paywall (see src/lib/limits.ts), so it
  // stays out of sight until it is nearly relevant. Showing "50 recipes left"
  // and a progress bar from the first cook makes a free product feel rationed
  // and invites people to count something they will never reach.
  if (usage.remaining > SHOW_WHEN_REMAINING_AT_MOST) return null

  const pct = Math.min(100, (usage.used / usage.limit) * 100)
  const isNearLimit = usage.remaining <= 3
  const isAtLimit = usage.remaining === 0

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 space-y-1.5 text-xs transition-colors',
        isAtLimit
          ? 'border-destructive/40 bg-destructive/5'
          : isNearLimit
          ? 'border-[hsl(var(--color-warning)/0.4)] bg-[hsl(var(--color-warning-muted))]'
          : 'border-border bg-muted/30',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn(
          'font-medium',
          isAtLimit ? 'text-destructive' : isNearLimit ? 'text-[hsl(var(--color-warning-fg))]' : 'text-foreground',
        )}>
          {isAtLimit ? 'Monthly limit reached' : `${usage.remaining} recipe${usage.remaining === 1 ? '' : 's'} left`}
        </span>
        <span className="text-muted-foreground">{usage.used}/{usage.limit}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            isAtLimit ? 'bg-destructive' : isNearLimit ? 'bg-[hsl(var(--color-warning))]' : 'bg-primary',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* No checkout exists yet (FOU-460), so "Upgrade to Pro" would send people
          to a page that cannot help them. Point at contact instead until there
          is something to buy. */}
      <p className="text-muted-foreground">
        {isAtLimit
          ? 'This resets at the start of next month. Get in touch if you need more.'
          : 'A generous monthly ceiling, not a paywall — it resets each month.'}
      </p>
    </div>
  )
}
