import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { Toaster } from '@/components/ui/toaster'
import { ConsentShell } from '@/components/consent-shell'
import { SwRegister } from '@/components/sw-register'
import { PwaInstallPrompt } from '@/components/pwa-install-prompt'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'IngredientBot — AI Recipe Assistant',
  description: 'AI-powered recipe suggestions based on ingredients you have.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://ingredientbot.com'),
  openGraph: {
    title: 'IngredientBot — AI Recipe Assistant',
    description: 'Tell it what\'s in your fridge. Get instant recipe ideas.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IngredientBot — AI Recipe Assistant',
    description: 'Tell it what\'s in your fridge. Get instant recipe ideas.',
  },
  // F43: PWA manifest
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'IngredientBot',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* F43: PWA theme color */}
        <meta name="theme-color" content="#c2613c" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {/* Skip-to-content: first focusable element, visible on focus for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
        >
          Skip to main content
        </a>
        <ConsentShell>
          <Providers>
            <Toaster>
              {children}
            </Toaster>
          </Providers>
        </ConsentShell>
        {/* F43: PWA service worker registration + install prompt */}
        <SwRegister />
        <PwaInstallPrompt />
      </body>
    </html>
  )
}
