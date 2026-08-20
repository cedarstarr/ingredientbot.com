import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PackageX, ChefHat } from 'lucide-react'

export const metadata = { title: 'Pantry — IngredientBot' }

// Pantry postponed 2026-08-20 (F26/F44/F46/F50 → 💤). UI is shelved but the
// PantryItem data + /api/user/pantry routes stay intact — nothing is deleted,
// so reopening this page is a UI-only change if pantry is un-postponed.
export default async function PantryPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <div className="max-w-4xl mx-auto px-10 py-8 pb-16" data-testid="pantry-shelved">
      <div className="flex flex-col items-center text-center gap-4 rounded-xl bg-card ring-1 ring-foreground/10 px-8 py-16">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground dark:bg-muted/30">
          <PackageX className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-[26px] font-bold tracking-tight leading-[1.1]">Pantry is taking a break</h1>
        <p className="text-muted-foreground text-[15px] max-w-md">
          We&apos;ve paused the pantry feature for now. Your saved items are still safe — nothing was deleted.
        </p>
        <Link
          href="/kitchen"
          className="mt-2 inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ChefHat className="h-4 w-4" aria-hidden />
          Go to Kitchen
        </Link>
      </div>
    </div>
  )
}
