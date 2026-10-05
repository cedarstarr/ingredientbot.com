'use client'

import { useEffect, useState } from 'react'
import PlausibleProvider from 'next-plausible'
import { CookieBanner } from '@/components/cookie-banner'

const EU_COUNTRIES = new Set([
  'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU',
  'IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK',
  'IS','LI','NO','GB',
])

function readConsent(): string | undefined {
  const m = document.cookie.match(/(?:^|;\s*)cookie-consent=([^;]*)/)
  return m ? decodeURIComponent(m[1]) : undefined
}

// Geo + consent moved out of the root layout so it no longer awaits headers()/cookies()
// and routes can render static/ISR. isEU stays null until /api/geo answers, so analytics
// is never enabled for a visitor whose region is still unknown (fails closed).
export function ConsentShell({ children }: { children: React.ReactNode }) {
  const [isEU, setIsEU] = useState<boolean | null>(null)
  const [consent, setConsent] = useState<string | undefined>(undefined)

  useEffect(() => {
    setConsent(readConsent())
    let cancelled = false
    fetch('/api/geo')
      .then((r) => (r.ok ? r.json() : { country: '' }))
      .then((d: { country?: string }) => {
        if (!cancelled) setIsEU(EU_COUNTRIES.has(d.country ?? ''))
      })
      .catch(() => {
        // Unknown region: treat as EU (stricter) so analytics needs explicit consent.
        if (!cancelled) setIsEU(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const plausibleEnabled = isEU !== null && (!isEU || consent === 'accepted')

  return (
    <>
      {/* next-plausible v4: domain + outbound-link tracking ride the script src + data-domain. */}
      <PlausibleProvider
        src="https://plausible.io/js/script.outbound-links.js"
        scriptProps={{
          'data-domain': process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ?? 'ingredientbot.com',
        } as React.ScriptHTMLAttributes<HTMLScriptElement>}
        enabled={plausibleEnabled}
      >
        {children}
      </PlausibleProvider>
      {isEU && !consent && <CookieBanner showBanner onChoice={setConsent} />}
    </>
  )
}
