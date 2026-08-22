'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordRequirements } from '@/components/auth/password-requirements'
import { ShieldAlert } from 'lucide-react'

export function ChangePasswordForm() {
  const router = useRouter()
  const { data: session } = useSession()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    const res = await fetch('/api/user/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setError(data?.error || 'Failed to update password')
      setLoading(false)
      return
    }

    // The old JWT is invalidated server-side (sessionsRevokedAt), so refresh
    // before navigating rather than relying on the stale client session.
    router.push('/kitchen')
    router.refresh()
  }

  return (
    <div className="rounded-lg border border-border bg-card px-8 py-10" data-testid="change-password-panel">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
          <ShieldAlert className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Update your password</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Your account requires a new password before you can continue.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive" data-testid="change-password-error">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="currentPassword">Current Password</Label>
          <Input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            data-testid="change-password-current"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="newPassword">New Password</Label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            data-testid="change-password-new"
          />
        </div>

        <PasswordRequirements
          password={newPassword}
          context={{ email: session?.user?.email, name: session?.user?.name }}
          testIdPrefix="change-password"
        />

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            data-testid="change-password-confirm"
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full" data-testid="change-password-submit">
          {loading ? 'Updating…' : 'Update Password'}
        </Button>
      </form>

      <div className="mt-6 border-t border-border pt-6 text-center text-sm">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-muted-foreground hover:text-foreground hover:underline"
          data-testid="change-password-sign-out"
        >
          Sign out instead
        </button>
      </div>
    </div>
  )
}
