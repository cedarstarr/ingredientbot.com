'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FolderOpen, Plus, ArrowRight, Trash2, BookOpen, ChefHat } from 'lucide-react'

const PALETTE = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6',
]

interface CollectionRecipe {
  id: string
  title: string
  cuisine?: string | null
}

interface Collection {
  id: string
  name: string
  description?: string | null
  color: string
  createdAt: string
  _count: { recipes: number }
  recipes: CollectionRecipe[]
}

interface CollectionsClientProps {
  collections: Collection[]
}

export function CollectionsClient({ collections: initial }: CollectionsClientProps) {
  const router = useRouter()
  const [collections, setCollections] = useState(initial)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newColor, setNewColor] = useState(PALETTE[0])
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, description: newDesc, color: newColor }),
      })
      if (res.ok) {
        const col = await res.json()
        setCollections(prev => [...prev, col])
        setCreating(false)
        setNewName('')
        setNewDesc('')
        setNewColor(PALETTE[0])
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/collections/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setCollections(prev => prev.filter(c => c.id !== id))
      }
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" aria-hidden="true" />
            <span>Collections</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Organise your recipes into folders
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Collection
        </Button>
      </div>

      {/* Grid */}
      {collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <FolderOpen className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">No collections yet</h2>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Create your first collection to organise your saved recipes — by cuisine, occasion, or anything you like.
          </p>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Collection
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {collections.map(col => (
            <div
              key={col.id}
              className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-sm transition-all duration-200 group"
            >
              {/* Collection header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: col.color + '20' }}
                  >
                    <FolderOpen className="h-5 w-5" style={{ color: col.color }} />
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/collections/${col.id}`}
                      className="font-semibold text-foreground hover:text-primary transition-colors leading-tight block truncate"
                    >
                      {col.name}
                    </Link>
                    {col.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{col.description}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(col.id)}
                  disabled={deletingId === col.id}
                  aria-label={`Delete ${col.name} collection`}
                  className="opacity-0 group-hover:opacity-100 rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Recipe preview */}
              {col.recipes.length > 0 ? (
                <div className="space-y-1 mb-3">
                  {col.recipes.map(r => (
                    <Link
                      key={r.id}
                      href={`/recipe/${r.id}`}
                      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
                    >
                      <BookOpen className="h-3 w-3 shrink-0" />
                      <span className="truncate">{r.title}</span>
                      {r.cuisine && <Badge variant="secondary" className="text-xs py-0 shrink-0">{r.cuisine}</Badge>}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mb-3 italic">No recipes yet</p>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {col._count.recipes} recipe{col._count.recipes !== 1 ? 's' : ''}
                </span>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/collections/${col.id}`}>
                    Open
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-primary" />
              New Collection
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="col-name">Name</Label>
              <Input
                id="col-name"
                placeholder="e.g. Quick Weeknight Dinners"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="col-desc">Description (optional)</Label>
              <Textarea
                id="col-desc"
                placeholder="What's in this collection?"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex gap-2">
                {PALETTE.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    aria-label={`Color ${c}`}
                    className={`h-6 w-6 rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${newColor === c ? 'scale-125 ring-2 ring-offset-1 ring-offset-background' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !newName.trim()}>
              {saving ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
