import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'

export const metadata = { title: 'Audit Logs — Admin — Robot Food' }

export default async function AdminAuditLogsPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
      <p className="text-muted-foreground">Last 100 events</p>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Action</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">User ID</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">IP</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-2.5 font-medium text-foreground">{log.action}</td>
                <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{log.userId?.slice(0, 12) ?? '—'}</td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">{log.ip || '—'}</td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">{formatDate(log.createdAt)}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No audit logs yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
