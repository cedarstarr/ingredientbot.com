'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Shield, Users, ScrollText, Bug, Terminal, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', icon: Shield, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users, exact: false },
  { href: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText, exact: false },
  { href: '/admin/scripts', label: 'Scripts', icon: Terminal, exact: false },
  { href: '/admin/ai-debug', label: 'AI Debug', icon: Bug, exact: false },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Admin sidebar */}
      <aside className="w-48 shrink-0 border-r border-border bg-card flex flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Shield className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm text-foreground">Admin</span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {ADMIN_NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary pl-[10px]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="p-2 border-t border-border">
          <Link
            href="/kitchen"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            Back to App
          </Link>
        </div>
      </aside>
      <main id="main-content" className="flex-1 min-w-0 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}
