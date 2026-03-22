'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Play, Loader2 } from 'lucide-react'

export default function ScriptRunButton({ scriptName }: { scriptName: string }) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null)

  async function handleRun() {
    if (!confirm(`Run ${scriptName}.ts? This will modify the database.`)) return
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch(`/api/admin/scripts/${scriptName}/run`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setResult({ success: true })
        // Reload to show updated last-run metadata
        window.location.reload()
      } else {
        setResult({ error: data.error ?? 'Unknown error' })
      }
    } catch (e) {
      setResult({ error: String(e) })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {result?.success && (
        <span className="text-xs text-green-600 dark:text-green-400">Ran successfully</span>
      )}
      {result?.error && (
        <span className="text-xs text-destructive max-w-xs truncate">{result.error}</span>
      )}
      <Button size="sm" variant="outline" onClick={handleRun} disabled={running}>
        {running ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Play className="h-3 w-3" />
        )}
        {running ? 'Running...' : 'Run Now'}
      </Button>
    </div>
  )
}
