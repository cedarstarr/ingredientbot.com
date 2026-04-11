'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { X, Plus, Loader2, ChefHat, Package } from 'lucide-react'

interface PantryItem {
  id: string
  ingredient: string
  addedAt: string
}

export function PantryClient() {
  const [items, setItems] = useState<PantryItem[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/user/pantry')
      if (res.ok) {
        const data = await res.json()
        setItems(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const addItem = async (ingredient: string) => {
    const trimmed = ingredient.trim().toLowerCase().replace(/,$/, '')
    if (!trimmed) return
    if (items.some(i => i.ingredient === trimmed)) {
      setInputValue('')
      return
    }

    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/user/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredient: trimmed }),
      })
      if (res.ok) {
        const item = await res.json()
        setItems(prev => [item, ...prev])
        setInputValue('')
      } else {
        setError('Failed to add ingredient')
      }
    } catch {
      setError('Failed to add ingredient')
    } finally {
      setAdding(false)
    }
  }

  const removeItem = async (id: string) => {
    setRemovingId(id)
    try {
      await fetch(`/api/user/pantry/${id}`, { method: 'DELETE' })
      setItems(prev => prev.filter(i => i.id !== id))
    } finally {
      setRemovingId(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addItem(inputValue)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading pantry...
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Add ingredient input */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-medium text-foreground">Add to Pantry</h2>
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. olive oil, garlic, pasta..."
            className="flex-1"
            disabled={adding}
          />
          <Button
            type="button"
            onClick={() => addItem(inputValue)}
            disabled={adding || !inputValue.trim()}
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="sr-only">Add</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Press Enter or comma to add. Items are included automatically when generating recipes.</p>
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>

      {/* Kitchen shortcut — only shown when pantry has items */}
      {items.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <ChefHat className="h-4 w-4 text-primary shrink-0" />
          <p className="text-sm text-foreground flex-1">
            Your {items.length} pantry item{items.length !== 1 ? 's' : ''} will be added to your next recipe generation.
          </p>
          <Link href="/kitchen">
            <Button size="sm" variant="outline" className="shrink-0">
              Go to Kitchen
            </Button>
          </Link>
        </div>
      )}

      {/* Pantry items list */}
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-10 text-center space-y-2">
          <Package className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-foreground">Your pantry is empty</p>
          <p className="text-xs text-muted-foreground">Add ingredients you keep stocked — they&apos;ll be used when generating recipes.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-medium text-foreground">
              Pantry Items
              <Badge variant="secondary" className="ml-2 text-xs">{items.length}</Badge>
            </h2>
          </div>
          <ul className="divide-y divide-border">
            {items.map(item => (
              <li key={item.id} className="flex items-center justify-between px-4 py-2.5 group">
                <span className="text-sm text-foreground capitalize">{item.ingredient}</span>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  disabled={removingId === item.id}
                  aria-label={`Remove ${item.ingredient} from pantry`}
                  className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {removingId === item.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <X className="h-3.5 w-3.5" />
                  }
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
