import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AdminLayoutClient from './admin-layout-client'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Authoritative forced-password-change gate, same as (app)/layout.tsx.
  // Kept as a thin server wrapper because the nav below needs usePathname()
  // and can't do this check itself as a client component.
  const session = await auth()
  // Defense in depth: the middleware admin gate is the first line, but a layout-level check
  // keeps /admin/users (every user's email) closed if a gate is ever skipped or reordered.
  if (!session?.user) redirect('/login')
  if (!session.user.isAdmin) redirect('/kitchen')
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { mustChangePassword: true },
    })
    if (user?.mustChangePassword) redirect('/change-password')
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>
}
