import { AppNav } from '@/components/app-nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppNav />
      <main id="main-content" className="flex-1 min-w-0 overflow-auto md:pt-0 pt-14">
        {children}
      </main>
    </div>
  )
}
