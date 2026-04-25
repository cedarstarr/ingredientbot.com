import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Users — Admin — Robot Food' }

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { id: true, email: true, name: true, isAdmin: true, createdAt: true, emailVerified: true }
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Users</h1>
      <p className="text-muted-foreground">{users.length} total users</p>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Email</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-2.5 font-medium text-foreground">{user.email}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{user.name || '—'}</td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1.5">
                    {user.isAdmin && <Badge className="text-xs">Admin</Badge>}
                    {user.emailVerified
                      ? <Badge variant="secondary" className="text-xs">Verified</Badge>
                      : <Badge variant="outline" className="text-xs text-muted-foreground">Unverified</Badge>
                    }
                  </div>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">{formatDate(user.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
