'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  ChefHat, BookOpen, LayoutDashboard, Settings, Shield,
  LogOut, Menu, X, CalendarDays, Link2, History, FolderOpen, Package, Sparkles,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

// F26: expiry urgency check (mirrors pantry-client logic)
function hasExpiringSoon(expiresAt: string): boolean {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const exp = new Date(expiresAt)
  exp.setHours(0, 0, 0, 0)
  const days = Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return days <= 7
}

// Primary nav — frequency-ordered: Kitchen first, daily-use tools up top
const NAV_LINKS = [
  { href: '/kitchen', label: 'Kitchen', icon: ChefHat },
  { href: '/pantry', label: 'Pantry', icon: Package },
  { href: '/saved', label: 'Saved Recipes', icon: BookOpen },
  { href: '/collections', label: 'Collections', icon: FolderOpen },
  { href: '/history', label: 'History', icon: History },
  { href: '/import', label: 'Import Recipe', icon: Link2 },
  { href: '/meal-plan', label: 'Meal Plan', icon: CalendarDays },
]

// Footer nav — low-frequency account/utility links
const FOOTER_NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/upgrade', label: 'Upgrade', icon: Sparkles },
  { href: '/settings', label: 'Settings', icon: Settings },
]

function NavLink({
  href, label, icon: Icon, active, onClick, badge,
}: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
  onClick?: () => void
  badge?: number
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-200',
        active
          ? 'bg-primary/10 text-primary font-medium ring-1 ring-inset ring-primary/20'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </Link>
  )
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  // F26: count expiring pantry items for nav badge
  const [expiringCount, setExpiringCount] = useState(0)

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/user/pantry')
      .then(r => r.ok ? r.json() : [])
      .then((items: Array<{ expiresAt: string | null }>) => {
        const count = items.filter(i => i.expiresAt && hasExpiringSoon(i.expiresAt)).length
        setExpiringCount(count)
      })
      .catch(() => {})
  }, [session?.user])

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4">
        <ChefHat className="h-5 w-5 shrink-0 text-primary" />
        <span className="font-semibold tracking-tight text-foreground text-sm">
          Robot Food
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Primary nav — kitchen + recipe tools */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_LINKS.map(({ href, label, icon }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={isActive(href)}
            onClick={onClose}
            badge={href === '/pantry' ? expiringCount : undefined}
          />
        ))}

        {session?.user?.isAdmin && (
          <NavLink
            href="/admin"
            label="Admin"
            icon={Shield}
            active={pathname.startsWith('/admin')}
            onClick={onClose}
          />
        )}
      </nav>

      {/* Footer nav — account + upgrade + settings */}
      <div className="shrink-0 border-t border-border px-2 pt-2 pb-1">
        <div className="space-y-0.5 mb-1">
          {FOOTER_NAV_LINKS.map(({ href, label, icon }) => (
            <NavLink
              key={href}
              href={href}
              label={label}
              icon={icon}
              active={isActive(href)}
              onClick={onClose}
            />
          ))}
        </div>

        {/* User info + sign out */}
        <div className="flex items-center justify-between px-3 py-1.5 mt-1">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground max-w-[120px]">
              {session?.user?.name || 'Account'}
            </p>
            <p className="truncate text-xs text-muted-foreground max-w-[120px]">
              {session?.user?.email}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <ThemeToggle />
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              aria-label="Sign out"
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AppNav() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col sticky top-0 h-screen border-r border-border bg-card">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 backdrop-blur-sm px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <ChefHat className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm text-foreground">Robot Food</span>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-50 w-64 bg-card border-r border-border h-full">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  )
}
