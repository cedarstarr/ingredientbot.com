import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'

export const metadata = { title: 'Admin — Robot Food' }

export default async function AdminPage() {
  const [userCount, recipeCount, recentLogs] = await Promise.all([
    prisma.user.count(),
    prisma.recipe.count(),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 })
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-3xl font-bold text-primary">{userCount}</p>
          <p className="text-sm text-muted-foreground mt-1">Total Users</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-3xl font-bold text-primary">{recipeCount}</p>
          <p className="text-sm text-muted-foreground mt-1">Total Recipes Generated</p>
        </div>
      </div>

      {/* Recent audit logs */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Recent Activity</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Action</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">User ID</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map(log => (
                <tr key={log.id} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-foreground">{log.action}</td>
                  <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{log.userId?.slice(0, 12) ?? '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{formatDate(log.createdAt)}</td>
                </tr>
              ))}
              {recentLogs.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No audit logs yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
