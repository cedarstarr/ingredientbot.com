'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChefHat, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CookedThisButtonProps {
  recipeId: string
  initialCookedCount: number
  initialLastCookedAt?: Date | string | null
}

export function CookedThisButton({ recipeId, initialCookedCount, initialLastCookedAt }: CookedThisButtonProps) {
  const [cookedCount, setCookedCount] = useState(initialCookedCount)
  const [lastCookedAt, setLastCookedAt] = useState<Date | null>(
    initialLastCookedAt ? new Date(initialLastCookedAt) : null,
  )
  const [loading, setLoading] = useState(false)
  const [justCooked, setJustCooked] = useState(false)

  const handleCook = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/recipes/${recipeId}/cook`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setCookedCount(data.cookedCount)
        setLastCookedAt(new Date(data.lastCookedAt))
        setJustCooked(true)
        // Reset the "just cooked" indicator after 3s
        setTimeout(() => setJustCooked(false), 3000)
      }
    } finally {
      setLoading(false)
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

  return (
    <div className="flex items-center gap-3">
      <Button
        variant={justCooked ? 'default' : 'outline'}
        size="sm"
        onClick={handleCook}
        disabled={loading}
        className={cn(
          'gap-2 transition-all',
          justCooked && 'bg-green-600 hover:bg-green-700 border-green-600 text-white dark:bg-green-600 dark:hover:bg-green-700',
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
  )
}
