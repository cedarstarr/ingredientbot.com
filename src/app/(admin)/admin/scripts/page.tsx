import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import fs from 'fs'
import path from 'path'
import ScriptRunButton from './script-run-button'

export const metadata = { title: 'Scripts — Admin — IngredientBot' }

function parseScriptMeta(filePath: string): { description: string; tables: string; adminRunnable: boolean } {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const descMatch = content.match(/@description\s+(.+)/)
    const tablesMatch = content.match(/@tables\s+(.+)/)
    const runnableMatch = content.match(/export\s+const\s+adminRunnable\s*=\s*(true|false)/)
    const adminRunnable = runnableMatch ? runnableMatch[1] === 'true' : true
    return {
      description: descMatch?.[1]?.trim() ?? 'No description',
      tables: tablesMatch?.[1]?.trim() ?? '—',
      adminRunnable,
    }
  } catch {
    return { description: 'No description', tables: '—', adminRunnable: true }
  }
}

export default async function AdminScriptsPage() {
  await requireAdmin()

  const scriptsDir = path.join(process.cwd(), 'scripts')
  const scriptFiles = fs.existsSync(scriptsDir)
    ? fs.readdirSync(scriptsDir).filter(f => f.endsWith('.ts') && !f.includes('__tests__') && !f.includes('vitest'))
    : []

  const logs: Record<string, {
    ranAt: Date
    status: string
    rowsAffected: unknown
    errorMessage: string | null
  }> = {}

  const recentLogs = await prisma.adminScriptLog.findMany({
    orderBy: { ranAt: 'desc' },
    distinct: ['scriptName'],
    select: { scriptName: true, ranAt: true, status: true, rowsAffected: true, errorMessage: true },
  })
  for (const log of recentLogs) {
    logs[log.scriptName] = log
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Scripts</h1>
        <p className="text-muted-foreground mt-1">
          Manage and run database scripts. Only run scripts you understand — they modify data.
        </p>
      </div>

      <div className="space-y-4">
        {scriptFiles.length === 0 && (
          <p className="text-muted-foreground">No scripts found in scripts/ directory.</p>
        )}
        {scriptFiles.map(file => {
          const name = file.replace('.ts', '')
          const filePath = path.join(scriptsDir, file)
          const meta = parseScriptMeta(filePath)
          const log = logs[name]
          const rowsAffected = log?.rowsAffected as { inserted?: number; updated?: number; deleted?: number } | null

          return (
            <Card key={name}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-base font-mono">{name}.ts</CardTitle>
                  <ScriptRunButton scriptName={name} adminRunnable={meta.adminRunnable} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">{meta.description}</p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span><strong>Tables:</strong> {meta.tables}</span>
                  {log ? (
                    <>
                      <span><strong>Last run:</strong> {new Date(log.ranAt).toLocaleString()}</span>
                      <Badge
                        variant={log.status === 'success' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {log.status}
                      </Badge>
                      {rowsAffected && (
                        <span>
                          +{rowsAffected.inserted ?? 0} inserted
                          {' · '}
                          ~{rowsAffected.updated ?? 0} updated
                          {' · '}
                          -{rowsAffected.deleted ?? 0} deleted
                        </span>
                      )}
                      {log.errorMessage && (
                        <span className="text-destructive">{log.errorMessage}</span>
                      )}
                    </>
                  ) : (
                    <span className="italic">Never run via admin panel</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
