'use client'

import { useState } from 'react'
import { Share2, Link as LinkIcon, X, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  recipeId: string
  initialSlug?: string | null
  initialIsPublic?: boolean
}

export function ShareRecipeButton({ recipeId, initialSlug, initialIsPublic }: Props) {
  const [isPublic, setIsPublic] = useState(initialIsPublic ?? false)
  const [slug, setSlug] = useState(initialSlug ?? null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  const publicUrl = slug ? `${typeof window !== 'undefined' ? window.location.origin : ''}/r/${slug}` : null

  const enableSharing = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/recipes/${recipeId}/share`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setSlug(data.slug)
        setIsPublic(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const disableSharing = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/recipes/${recipeId}/share`, { method: 'DELETE' })
      if (res.ok) {
        setSlug(null)
        setIsPublic(false)
        setOpen(false)
      }
    } finally {
      setLoading(false)
    }
  }

  const copyLink = async () => {
    if (!publicUrl) return
    await navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Toggle popover open — enable sharing automatically on first open
  const handleToggleOpen = async () => {
    if (!open && !isPublic) {
      setOpen(true)
      await enableSharing()
    } else {
      setOpen(v => !v)
    }
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggleOpen}
        title="Share recipe"
        className={cn(
          'h-7 w-7 p-0 focus-visible:ring-2 focus-visible:ring-ring',
          isPublic && 'text-primary'
        )}
        aria-label="Share recipe"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Popover */}
          <div role="dialog" aria-label="Share recipe" className="absolute right-0 top-8 z-50 w-72 rounded-xl border border-border bg-card shadow-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Share Recipe</p>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                aria-label="Close share dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating link...
              </div>
            ) : isPublic && publicUrl ? (
              <>
                <p className="text-xs text-muted-foreground">Anyone with this link can view the recipe (no sign-in required).</p>
                <div className="flex gap-2">
                  <code className="flex-1 rounded-md bg-muted px-2 py-1.5 text-xs text-foreground truncate select-all">
                    {publicUrl}
                  </code>
                  <Button size="sm" variant="outline" onClick={copyLink} className="shrink-0 gap-1.5">
                    {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <LinkIcon className="h-3.5 w-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                <button
                  onClick={disableSharing}
                  disabled={loading}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  Revoke public link
                </button>
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
