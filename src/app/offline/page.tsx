import { ChefHat, WifiOff } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Offline — Robot Food' }

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <WifiOff className="h-9 w-9 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">You&apos;re offline</h1>
        <p className="max-w-xs text-muted-foreground text-sm">
          No internet connection. Your saved recipes are still available — connect to generate new ones.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Button asChild>
          <Link href="/saved">
            <ChefHat className="mr-2 h-4 w-4" />
            View Saved Recipes
          </Link>
        </Button>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
