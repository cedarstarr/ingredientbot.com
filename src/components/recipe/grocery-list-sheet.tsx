'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ShoppingCart, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Ingredient {
  name: string
  amount: string
  unit: string
}

interface GroceryListSheetProps {
  ingredients: Ingredient[]
}

function formatIngredient(ing: Ingredient): string {
  const parts = [ing.amount, ing.unit, ing.name].filter(Boolean)
  return parts.join(' ').trim()
}

export function GroceryListSheet({ ingredients }: GroceryListSheetProps) {
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [copied, setCopied] = useState(false)

  const toggle = (i: number) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const handleCopy = async () => {
    const unchecked = ingredients
      .filter((_, i) => !checked.has(i))
      .map(formatIngredient)
      .join('\n')
    try {
      await navigator.clipboard.writeText(unchecked)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback — ignore
    }
  }

  const uncheckedCount = ingredients.length - checked.size

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ShoppingCart className="h-3.5 w-3.5" />
          Shopping List
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Shopping List
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {uncheckedCount} item{uncheckedCount !== 1 ? 's' : ''} remaining
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-1.5"
              disabled={uncheckedCount === 0}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[hsl(var(--color-success))]" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy all
                </>
              )}
            </Button>
          </div>

          <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {ingredients.map((ing, i) => (
              <li key={i}>
                <button
                  onClick={() => toggle(i)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-left transition-colors',
                    'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    checked.has(i) && 'opacity-50',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input transition-colors',
                      checked.has(i) && 'bg-primary border-primary',
                    )}
                  >
                    {checked.has(i) && <Check className="h-3 w-3 text-primary-foreground" />}
                  </span>
                  <span
                    className={cn(
                      'flex-1 transition-colors',
                      checked.has(i) && 'line-through text-muted-foreground',
                    )}
                  >
                    <span className="font-medium text-primary mr-1">
                      {ing.amount} {ing.unit}
                    </span>
                    {ing.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {ingredients.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">
              No ingredients found in this recipe.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
