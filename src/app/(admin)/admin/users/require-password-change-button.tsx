'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { KeyRound, Loader2, Check } from 'lucide-react'

export default function RequirePasswordChangeButton({
  userId,
  initiallyRequired,
}: {
  userId: string
  initiallyRequired: boolean
}) {
  const [required, setRequired] = useState(initiallyRequired)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleClick() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${userId}/require-password-change`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || 'Failed to update user')
      } else {
        setRequired(true)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  if (required) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
        data-testid={`admin-users-password-required-${userId}`}
      >
        <Check className="h-3 w-3" aria-hidden="true" /> Required
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button
        size="sm"
        variant="outline"
        onClick={handleClick}
        disabled={loading}
        data-testid={`admin-users-require-password-change-${userId}`}
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <KeyRound className="h-3 w-3" />}
        {loading ? 'Updating…' : 'Require password change'}
      </Button>
    </div>
  )
}
