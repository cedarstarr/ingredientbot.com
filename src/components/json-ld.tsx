import { headers } from 'next/headers'
import { safeJsonLdString } from '@/lib/utils'

// FOU-538. CSP's script-src (and 'strict-dynamic') is enforced against every <script>
// element regardless of its `type` attribute — an un-nonced type="application/ld+json"
// tag is blocked exactly like a JS one, it just never showed up in the Sentry reports
// that drove the rest of that fix because no browser executes it, so nothing failed
// visibly for a user. It's still a live violation once the header is Content-Security-Policy
// rather than -Report-Only. Nonce travels on x-nonce, minted per-request in
// src/middleware.ts and readable from any Server Component via headers() — this one
// reads it directly rather than threading it down as a prop, since JSON-LD blocks are
// each local to the page that renders them.
export async function JsonLd({ data }: { data: unknown }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: safeJsonLdString(data) }}
    />
  )
}
