import { AppNav } from '@/components/app-nav'
import { AllergyAwarenessNotice } from '@/components/allergy-awareness-notice'

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
