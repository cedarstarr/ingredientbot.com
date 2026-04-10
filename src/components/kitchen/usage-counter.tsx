'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UsageData {
  isPro: boolean
  used: number
  limit: number
  remaining: number | null
}

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

  if (!usage || usage.isPro) return null

  const pct = Math.min(100, (usage.used / usage.limit) * 100)
  const isNearLimit = usage.remaining !== null && usage.remaining <= 1
  const isAtLimit = usage.remaining === 0

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 space-y-1.5 text-xs transition-colors',
        isAtLimit
          ? 'border-destructive/40 bg-destructive/5'
          : isNearLimit
          ? 'border-amber-400/40 bg-amber-50 dark:bg-amber-900/10'
          : 'border-border bg-muted/30',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn(
          'font-medium',
          isAtLimit ? 'text-destructive' : isNearLimit ? 'text-amber-600 dark:text-amber-400' : 'text-foreground',
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
            isAtLimit ? 'bg-destructive' : isNearLimit ? 'bg-amber-500' : 'bg-primary',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <Link
        href="/upgrade"
        className="flex items-center gap-1 text-primary hover:underline font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        <Sparkles className="h-3 w-3" />
        {isAtLimit ? 'Upgrade for unlimited' : 'Upgrade to Pro'}
      </Link>
    </div>
  )
}
