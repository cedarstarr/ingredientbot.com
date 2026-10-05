import { safeJsonLdString } from '@/lib/utils'

// Plain inline JSON-LD. No nonce: the CSP is static ('unsafe-inline', see src/middleware.ts),
// which lets this render without reading headers() and keeps pages static/ISR.
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdString(data) }}
    />
  )
}
