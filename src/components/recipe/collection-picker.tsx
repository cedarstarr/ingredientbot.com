'use client'

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/toaster'
import { FolderOpen, Folder } from 'lucide-react'

interface Collection {
  id: string
  name: string
  color: string
}

interface CollectionPickerProps {
  recipeId: string
  collections: Collection[]
  currentCollectionId?: string | null
}

export function CollectionPicker({ recipeId, collections, currentCollectionId }: CollectionPickerProps) {
  const { toast } = useToast()
  const [value, setValue] = useState<string>(currentCollectionId ?? 'none')
  const [saving, setSaving] = useState(false)

  const handleChange = async (newValue: string) => {
    const prev = value
    setValue(newValue)
    setSaving(true)
    try {
      const res = await fetch(`/api/recipes/${recipeId}/collection`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId: newValue === 'none' ? null : newValue }),
      })
      if (!res.ok) {
        setValue(prev) // revert optimistic selection on failure
        toast({ title: 'Could not update collection', description: 'Please try again.', variant: 'destructive' })
      }
    } catch {
      setValue(prev)
      toast({ title: 'Could not update collection', description: 'Please try again.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (collections.length === 0) return null

  const current = collections.find(c => c.id === value)

  return (
    <div className="flex items-center gap-2">
      {current ? (
        <FolderOpen className="h-4 w-4 shrink-0" style={{ color: current.color }} />
      ) : (
        <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <Select value={value} onValueChange={handleChange} disabled={saving}>
        <SelectTrigger className="h-8 text-xs w-44 border-dashed">
          <SelectValue placeholder="Add to collection…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="text-muted-foreground">No collection</span>
          </SelectItem>
          {collections.map(c => (
            <SelectItem key={c.id} value={c.id}>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                {c.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {saving && <span className="text-xs text-muted-foreground">saving…</span>}
    </div>
  )
}
