/**
 * SSRF guard utilities — block private/loopback/link-local/cloud-metadata destinations.
 * Hostname blocklist over DNS resolution: covers the 99% attack surface
 * (cloud metadata IP, literal localhost, RFC1918 addresses) without an extra dep.
 */

export function isPrivateIPv4(parts: number[]): boolean {
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false
  const [a, b] = parts
  if (a === 0 || a === 127) return true                 // 0.0.0.0/8, 127.0.0.0/8
  if (a === 10) return true                             // 10.0.0.0/8
  if (a === 192 && b === 168) return true               // 192.168.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true      // 172.16.0.0/12
  if (a === 169 && b === 254) return true               // 169.254.0.0/16 (link-local + AWS/GCP metadata)
  if (a >= 224) return true                             // multicast/reserved
  return false
}

// Decode every IPv4 textual variant the URL parser leaves through:
// dotted-decimal (1.2.3.4), 32-bit decimal (2130706433), octal (0177.0.0.1),
// hex (0x7f.0.0.1). Anything that resolves to a private/loopback range fails.
export function decodeIPv4Variants(host: string): number[] | null {
  const parts = host.split('.')
  const parsed: number[] = []
  for (const p of parts) {
    if (p.length === 0) return null
    let n: number
    if (/^0x[0-9a-f]+$/i.test(p)) n = parseInt(p, 16)
    else if (/^0[0-7]+$/.test(p)) n = parseInt(p, 8)
    else if (/^[0-9]+$/.test(p)) n = parseInt(p, 10)
    else return null
    parsed.push(n)
  }
  // Single-integer form (http://2130706433/) collapses to a u32; explode to 4 octets.
  if (parsed.length === 1) {
    const n = parsed[0]
    if (n < 0 || n > 0xffffffff) return null
    return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
  }
  if (parsed.length === 4) return parsed
  return null
}

export function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    const host = url.hostname.toLowerCase()
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host === 'metadata.google.internal' ||
      host === '[::1]' || host === '::1' ||
      host.startsWith('::1') ||
      host.startsWith('fc') || host.startsWith('fd') || // fc00::/7 unique-local IPv6
      host.startsWith('fe80:')                          // link-local IPv6
    ) {
      return false
    }
    // IPv4 in any encoding (dotted, decimal, octal, hex)
    const ipv4 = decodeIPv4Variants(host)
    if (ipv4 && isPrivateIPv4(ipv4)) return false
    return true
  } catch {
    return false
  }
}
