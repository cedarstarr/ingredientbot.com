'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from 'next-themes'

// `nonce` comes from the root layout (the only place headers() is readable — this is a
// client component). next-themes renders its pre-paint theme script inline during SSR
// and stamps this value on it; without it the script is the one thing on the page the
// CSP in src/middleware.ts cannot vouch for (FOU-538).
export function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem nonce={nonce}>
      <SessionProvider>{children}</SessionProvider>
    </ThemeProvider>
  )
}
