'use client'
import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body className="m-0 bg-background text-foreground font-sans">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="max-w-md text-center">
            <p className="text-4xl mb-2">🤖</p>
            <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
            <p className="mb-6 text-muted-foreground">An unexpected error occurred. Our team has been notified.</p>
            <button
              onClick={reset}
              className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
