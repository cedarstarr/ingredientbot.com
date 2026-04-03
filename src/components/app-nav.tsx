'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  ChefHat, BookOpen, LayoutDashboard, Settings, Shield,
  LogOut, Menu, X, CalendarDays, Link2,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

const NAV_LINKS = [
  { href: '/kitchen', label: 'Kitchen', icon: ChefHat },
  { href: '/import', label: 'Import Recipe', icon: Link2 },
  { href: '/saved', label: 'Saved Recipes', icon: BookOpen },
  { href: '/meal-plan', label: 'Meal Plan', icon: CalendarDays },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/settings', label: 'Settings', icon: Settings },
]

function NavLink({
  href, label, icon: Icon, active, onClick,
}: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
  onClick?: () => void
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
      {label}
    </Link>
  )
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()

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

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_LINKS.map(({ href, label, icon }) => (
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

      {/* Footer */}
      <div className="shrink-0 border-t border-border px-2 py-3">
        <div className="flex items-center justify-between px-3 py-1.5">
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
