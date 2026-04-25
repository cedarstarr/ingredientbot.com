import { requireAdmin } from '@/lib/admin'
import { AiDebugClient } from './ai-debug-client'

export const metadata = { title: 'AI Debug — Admin — Robot Food' }

export default async function AiDebugPage() {
  await requireAdmin()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Debug Console</h1>
        <p className="text-sm text-muted-foreground mt-1">Manually trigger cron jobs and test auth flows.</p>
      </div>
      <AiDebugClient />
    </div>
  )
}
