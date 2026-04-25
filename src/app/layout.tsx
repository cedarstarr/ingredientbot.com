import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { headers, cookies } from 'next/headers'
import './globals.css'
import { Providers } from '@/components/providers'
import { Toaster } from '@/components/ui/toaster'
import PlausibleProvider from 'next-plausible'
import { CookieBanner } from '@/components/cookie-banner'
import { SwRegister } from '@/components/sw-register'
import { PwaInstallPrompt } from '@/components/pwa-install-prompt'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'IngredientBot — AI Recipe Assistant',
  description: 'AI-powered recipe suggestions based on ingredients you have.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://ingredientbot.com'),
  openGraph: {
    title: 'IngredientBot — AI Recipe Assistant',
    description: 'Tell it what\'s in your fridge. Get instant recipe ideas powered by Claude AI.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IngredientBot — AI Recipe Assistant',
    description: 'Tell it what\'s in your fridge. Get instant recipe ideas powered by Claude AI.',
  },
  // F43: PWA manifest
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'IngredientBot',
  },
}

const EU_COUNTRIES = new Set([
  'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU',
  'IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK',
  'IS','LI','NO','GB',
])

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const country = (await headers()).get('x-vercel-ip-country') ?? ''
  const isEU = EU_COUNTRIES.has(country)
  const consent = (await cookies()).get('cookie-consent')?.value
  const plausibleEnabled = !isEU || consent === 'accepted'

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
        <PlausibleProvider
          domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ?? 'ingredientbot.com'}
          trackOutboundLinks
          enabled={plausibleEnabled}
        >
          <Providers>
            <Toaster>
              {children}
            </Toaster>
          </Providers>
        </PlausibleProvider>
        <CookieBanner showBanner={isEU && !consent} />
        {/* F43: PWA service worker registration + install prompt */}
        <SwRegister />
        <PwaInstallPrompt />
      </body>
    </html>
  )
}
