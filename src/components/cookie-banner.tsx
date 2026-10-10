'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

export function CookieBanner({ showBanner }: { showBanner: boolean }) {
  const router = useRouter()
  const [visible, setVisible] = useState(showBanner)

  if (!visible) return null

  const setCookie = (value: string) => {
    document.cookie = `cookie-consent=${value}; max-age=31536000; path=/; SameSite=Lax`
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 p-4 backdrop-blur-sm dark:bg-background/95">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          We use cookies for authentication and analytics to understand how our site is used.{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => {
              setCookie('rejected')
              setVisible(false)
            }}
            aria-label="Reject non-essential cookies"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:hover:bg-muted"
          >
            Reject
          </button>
          <button
            onClick={() => {
              setCookie('accepted')
              setVisible(false)
              router.refresh()
            }}
            aria-label="Accept all cookies"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
