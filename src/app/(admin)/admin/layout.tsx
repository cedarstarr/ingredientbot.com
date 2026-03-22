import { requireAdmin } from '@/lib/admin'
import Link from 'next/link'
import { Shield, Users, ScrollText, Bug, Terminal } from 'lucide-react'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Admin sidebar */}
      <aside className="w-48 shrink-0 border-r border-border bg-card flex flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Shield className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm text-foreground">Admin</span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          <Link href="/admin" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <Shield className="h-4 w-4" />
            Overview
          </Link>
          <Link href="/admin/users" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <Users className="h-4 w-4" />
            Users
          </Link>
          <Link href="/admin/audit-logs" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <ScrollText className="h-4 w-4" />
            Audit Logs
          </Link>
          <Link href="/admin/scripts" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <Terminal className="h-4 w-4" />
            Scripts
          </Link>
          <Link href="/admin/ai-debug" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <Bug className="h-4 w-4" />
            AI Debug
          </Link>
        </nav>
        <div className="p-2 border-t border-border">
          <Link href="/kitchen" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            ← Back to App
          </Link>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}
