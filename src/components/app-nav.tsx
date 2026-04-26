'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  ChefHat, BookOpen, LayoutDashboard, Settings, Shield,
  LogOut, Menu, X, CalendarDays, Link2, History, FolderOpen, Package, Sparkles,
  BarChart3,
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

// Nav grouped per design: Cooking | Activity | Account
const COOKING_LINKS = [
  { href: '/kitchen',    label: 'Kitchen',       icon: ChefHat },
  { href: '/pantry',     label: 'Pantry',        icon: Package },
  { href: '/saved',      label: 'Saved Recipes', icon: BookOpen },
  { href: '/meal-plan',  label: 'Meal Plan',     icon: CalendarDays },
]

const ACTIVITY_LINKS = [
  { href: '/history',    label: 'History',   icon: History },
  { href: '/dashboard',  label: 'Insights',  icon: BarChart3 },
]

const ACCOUNT_LINKS = [
  { href: '/collections', label: 'Collections',   icon: FolderOpen },
  { href: '/import',      label: 'Import Recipe', icon: Link2 },
  { href: '/upgrade',     label: 'Upgrade',       icon: Sparkles },
  { href: '/settings',    label: 'Settings',      icon: Settings },
]

function NavSection({ label }: { label: string }) {
  return (
    <div className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground select-none">
      {label}
    </div>
  )
}

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
        <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent text-accent-foreground px-1 text-[10px] font-bold">
          {badge}
        </span>
      )}
    </Link>
  )
}

function UserAvatar({ name }: { name?: string | null }) {
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-[13px] font-semibold select-none">
      {initials}
    </div>
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
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ChefHat className="h-[18px] w-[18px]" />
        </div>
        <span className="font-semibold tracking-tight text-foreground text-sm">
          IngredientBot
        </span>
        <span className="ml-auto rounded-full bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
          beta
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-1 rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Scrollable nav */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-2 py-1">
        <NavSection label="Cooking" />
        {COOKING_LINKS.map(({ href, label, icon }) => (
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

        <NavSection label="Activity" />
        {ACTIVITY_LINKS.map(({ href, label, icon }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={isActive(href)}
            onClick={onClose}
          />
        ))}

        <NavSection label="Account" />
        {ACCOUNT_LINKS.map(({ href, label, icon }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={isActive(href)}
            onClick={onClose}
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

      {/* User row */}
      <div className="shrink-0 border-t border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2.5">
          <UserAvatar name={session?.user?.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-foreground leading-tight">
              {session?.user?.name || 'Account'}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {session?.user?.email}
            </p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
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
      {/* Desktop sidebar — bg-sidebar keeps it slightly cooler/warmer than page bg */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col sticky top-0 h-screen border-r border-sidebar-border bg-sidebar">
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
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
          <ChefHat className="h-4 w-4" />
        </div>
        <span className="font-semibold text-sm text-foreground">IngredientBot</span>
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
          <aside className="relative z-50 w-64 bg-sidebar border-r border-sidebar-border h-full">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  )
}
