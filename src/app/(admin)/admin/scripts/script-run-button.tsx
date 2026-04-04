'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Play, Loader2, AlertTriangle } from 'lucide-react'

export default function ScriptRunButton({
  scriptName,
  adminRunnable = true,
}: {
  scriptName: string
  adminRunnable?: boolean
}) {
  const [running, setRunning] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null)

  async function handleRun() {
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch(`/api/admin/scripts/${scriptName}/run`, { method: 'POST' })
      const data = await res.json()
      setResult(res.ok ? { success: true } : { error: data.error })
    } catch (e) {
      setResult({ error: String(e) })
    } finally {
      setRunning(false)
      setConfirmed(false)
    }
  }

  if (!adminRunnable) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> Destructive / one-time script
        </p>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`confirm-${scriptName}`}
            checked={confirmed}
            onCheckedChange={(v) => setConfirmed(!!v)}
          />
          <label htmlFor={`confirm-${scriptName}`} className="text-xs text-muted-foreground cursor-pointer">
            I understand this may be irreversible
          </label>
        </div>
        <div className="flex items-center gap-2">
          {result?.success && <span className="text-xs text-green-600 dark:text-green-400">✓ Ran successfully</span>}
          {result?.error && <span className="text-xs text-destructive">{result.error}</span>}
          <Button size="sm" variant="destructive" onClick={handleRun} disabled={running || !confirmed}>
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
            {running ? 'Running...' : 'Run Anyway'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {result?.success && <span className="text-xs text-green-600 dark:text-green-400">✓ Ran successfully</span>}
      {result?.error && <span className="text-xs text-destructive">{result.error}</span>}
      <Button size="sm" variant="outline" onClick={handleRun} disabled={running}>
        {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
        {running ? 'Running...' : 'Run Now'}
      </Button>
    </div>
  )
}
