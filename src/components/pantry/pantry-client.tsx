'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { X, Plus, Loader2, ChefHat, Package, Calendar, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PantryItem {
  id: string
  ingredient: string
  addedAt: string
  expiresAt: string | null
}

// F26: expiry urgency helpers
function daysUntilExpiry(expiresAt: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const exp = new Date(expiresAt)
  exp.setHours(0, 0, 0, 0)
  return Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function expiryUrgency(expiresAt: string | null): 'critical' | 'soon' | null {
  if (!expiresAt) return null
  const days = daysUntilExpiry(expiresAt)
  if (days <= 3) return 'critical'
  if (days <= 7) return 'soon'
  return null
}

function ExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return null
  const days = daysUntilExpiry(expiresAt)
  const urgency = expiryUrgency(expiresAt)

  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive text-xs px-1.5 py-0.5 font-medium">
        <AlertTriangle className="h-3 w-3" />
        Expired
      </span>
    )
  }

  if (urgency === 'critical') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs px-1.5 py-0.5 font-medium">
        <span aria-hidden>🔴</span>
        {days === 0 ? 'Today' : `${days}d`}
      </span>
    )
  }

  if (urgency === 'soon') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs px-1.5 py-0.5 font-medium">
        <span aria-hidden>🟡</span>
        {days}d
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Calendar className="h-3 w-3" />
      {days}d
    </span>
  )
}

export function PantryClient() {
  const [items, setItems] = useState<PantryItem[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [editingExpiryId, setEditingExpiryId] = useState<string | null>(null)
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

  // F26: update expiry date for a pantry item
  const updateExpiry = async (id: string, expiresAt: string | null) => {
    try {
      const res = await fetch(`/api/user/pantry/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresAt }),
      })
      if (res.ok) {
        const updated = await res.json()
        setItems(prev => prev.map(i => i.id === id ? updated : i))
      }
    } catch {
      // silent — non-critical update
    } finally {
      setEditingExpiryId(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addItem(inputValue)
    }
  }

  // F26: count items expiring within 7 days for the info banner
  const expiringCount = items.filter(i => i.expiresAt && expiryUrgency(i.expiresAt) !== null).length

  return (
    <div className="space-y-5">
      {/* Add ingredient input — always rendered so it's immediately interactive */}
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

      {/* F26: Expiring soon banner */}
      {expiringCount > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-400/40 bg-amber-50 dark:bg-amber-900/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300 flex-1">
            {expiringCount} item{expiringCount !== 1 ? 's' : ''} expiring within 7 days.{' '}
            <Link href="/kitchen" className="font-medium underline underline-offset-2">
              Use them in the Kitchen
            </Link>{' '}
            with Expiry-first mode.
          </p>
        </div>
      )}

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
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading pantry...
        </div>
      ) : items.length === 0 ? (
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
              <li key={item.id} className="group">
                <div className="flex items-center gap-2 px-4 py-2.5">
                  <span className="text-sm text-foreground capitalize flex-1">{item.ingredient}</span>

                  {/* F26: Expiry badge / date editor */}
                  <div className="flex items-center gap-1.5">
                    {editingExpiryId === item.id ? (
                      <input
                        type="date"
                        defaultValue={item.expiresAt ? new Date(item.expiresAt).toISOString().split('T')[0] : ''}
                        autoFocus
                        min={new Date().toISOString().split('T')[0]}
                        className={cn(
                          'text-xs rounded border border-border bg-background px-2 py-0.5',
                          'text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        )}
                        onChange={e => {
                          if (e.target.value) updateExpiry(item.id, e.target.value)
                        }}
                        onBlur={e => {
                          if (!e.target.value) setEditingExpiryId(null)
                        }}
                      />
                    ) : (
                      <>
                        <ExpiryBadge expiresAt={item.expiresAt} />
                        <button
                          type="button"
                          onClick={() => setEditingExpiryId(item.id)}
                          title="Set expiry date"
                          aria-label={`Set expiry date for ${item.ingredient}`}
                          className={cn(
                            'rounded p-1 text-muted-foreground hover:text-primary transition-colors',
                            'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            item.expiresAt && 'opacity-100',
                          )}
                        >
                          <Calendar className="h-3.5 w-3.5" />
                        </button>
                        {item.expiresAt && (
                          <button
                            type="button"
                            onClick={() => updateExpiry(item.id, null)}
                            title="Clear expiry date"
                            aria-label={`Clear expiry date for ${item.ingredient}`}
                            className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>

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
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
