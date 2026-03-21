'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ResultState = { ok: boolean; data: unknown } | null

function ResultBox({ result }: { result: ResultState }) {
  if (!result) return null
  return (
    <pre className={`mt-3 rounded-lg border p-3 text-xs overflow-auto max-h-48 font-mono ${result.ok ? 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400' : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400'}`}>
      {JSON.stringify(result.data, null, 2)}
    </pre>
  )
}

export function AiDebugClient() {
  // Welcome Drip
  const [dripLoading, setDripLoading] = useState(false)
  const [dripResult, setDripResult] = useState<ResultState>(null)

  async function triggerDrip() {
    setDripLoading(true)
    setDripResult(null)
    try {
      const res = await fetch('/api/cron/welcome-drip', {
        method: 'GET',
        headers: process.env.NEXT_PUBLIC_CRON_SECRET
          ? { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}` }
          : {},
      })
      const data = await res.json()
      setDripResult({ ok: res.ok, data })
    } catch (err) {
      setDripResult({ ok: false, data: { error: String(err) } })
    } finally {
      setDripLoading(false)
    }
  }

  // Sign Out All Devices
  const [signoutLoading, setSignoutLoading] = useState(false)
  const [signoutResult, setSignoutResult] = useState<ResultState>(null)

  async function triggerSignoutAll() {
    setSignoutLoading(true)
    setSignoutResult(null)
    try {
      const res = await fetch('/api/auth/signout-all', { method: 'POST' })
      const data = await res.json()
      setSignoutResult({ ok: res.ok, data })
    } catch (err) {
      setSignoutResult({ ok: false, data: { error: String(err) } })
    } finally {
      setSignoutLoading(false)
    }
  }

  // Email Change Flow
  const [emailNewEmail, setEmailNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailResult, setEmailResult] = useState<ResultState>(null)

  async function triggerEmailChange(e: React.FormEvent) {
    e.preventDefault()
    setEmailLoading(true)
    setEmailResult(null)
    try {
      const res = await fetch('/api/user/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: emailNewEmail, currentPassword: emailPassword }),
      })
      const data = await res.json()
      setEmailResult({ ok: res.ok, data })
    } catch (err) {
      setEmailResult({ ok: false, data: { error: String(err) } })
    } finally {
      setEmailLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Welcome Drip Cron */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Welcome Drip Cron</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Triggers <code className="font-mono">GET /api/cron/welcome-drip</code> — sends welcome emails to eligible users created in the last 25 hours.
          </p>
        </div>
        <Button
          onClick={triggerDrip}
          disabled={dripLoading}
          size="sm"
        >
          {dripLoading ? 'Running…' : 'Run Welcome Drip'}
        </Button>
        <ResultBox result={dripResult} />
      </div>

      {/* Sign Out All Devices */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Sign Out All Devices</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Triggers <code className="font-mono">POST /api/auth/signout-all</code> — sets <code className="font-mono">sessionsRevokedAt</code> for your account, invalidating all active JWT sessions.
          </p>
        </div>
        <Button
          onClick={triggerSignoutAll}
          disabled={signoutLoading}
          variant="destructive"
          size="sm"
        >
          {signoutLoading ? 'Revoking…' : 'Sign Out All Devices'}
        </Button>
        <ResultBox result={signoutResult} />
      </div>

      {/* Email Change Flow */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Email Change Flow</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Triggers <code className="font-mono">POST /api/user/email</code> — initiates an email change verification for the currently logged-in user.
          </p>
        </div>
        <form onSubmit={triggerEmailChange} className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="newEmail" className="text-xs">New Email Address</Label>
            <Input
              id="newEmail"
              type="email"
              placeholder="new@example.com"
              value={emailNewEmail}
              onChange={e => setEmailNewEmail(e.target.value)}
              required
              className="h-8 text-sm"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="currentPassword" className="text-xs">Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              placeholder="Current password"
              value={emailPassword}
              onChange={e => setEmailPassword(e.target.value)}
              required
              className="h-8 text-sm"
            />
          </div>
          <Button type="submit" disabled={emailLoading} size="sm">
            {emailLoading ? 'Sending…' : 'Send Verification Email'}
          </Button>
        </form>
        <ResultBox result={emailResult} />
      </div>
    </div>
  )
}
