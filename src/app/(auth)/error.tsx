'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

// Error boundary scoped to the (auth) route group — preserves auth layout
export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // intentional: surface errors in monitoring tools
    console.error('[Auth error boundary]', error)
  }, [error])

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-20">
      <div className="max-w-md text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
        <h1 className="mb-2 text-xl font-bold">Something went wrong</h1>
        <p className="mb-6 text-muted-foreground text-sm">
          We hit an unexpected error. Please try again or return to sign in.
        </p>
        <div className="flex justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" onClick={() => (window.location.href = '/login')}>
            Back to Sign In
          </Button>
        </div>
      </div>
    </div>
  )
}
