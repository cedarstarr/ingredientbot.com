import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppNav } from '@/components/app-nav'
import { AllergyAwarenessNotice } from '@/components/allergy-awareness-notice'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Authoritative forced-password-change gate. Deliberately NOT in
  // middleware.ts — middleware runs on the Edge runtime and this needs Prisma.
  const session = await auth()
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { mustChangePassword: true },
    })
    if (user?.mustChangePassword) redirect('/change-password')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppNav />
      {/* the notice lives inside the scroll container, not below it — <main> is the only
          scrolling element in this shell, so anything outside it would be unreachable */}
      <main id="main-content" className="flex-1 min-w-0 overflow-auto md:pt-0 pt-14">
        {children}
        <footer className="border-t border-border px-4 py-5">
          <AllergyAwarenessNotice />
        </footer>
      </main>
    </div>
  )
}
