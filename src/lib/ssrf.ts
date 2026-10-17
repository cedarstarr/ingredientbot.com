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

// The WHATWG parser normalises every IPv6 form to compressed lowercase hex, and rewrites
// ::ffff:127.0.0.1 to ::ffff:7f00:1 — so a prefix/hex match on the normalised text is enough.
// chose this over the old startsWith('fc'|'fd') on the raw host because that also blocked
// public names like fcbarcelona.com while missing every bracketed literal.
export function isPrivateIPv6(addr: string): boolean {
  if (addr === '::' || addr === '::1') return true
  if (/^f[cd][0-9a-f]{2}:/.test(addr)) return true     // fc00::/7 unique-local
  if (/^fe[89ab][0-9a-f]:/.test(addr)) return true     // fe80::/10 link-local
  if (/^ff[0-9a-f]{2}:/.test(addr)) return true        // ff00::/8 multicast
  const mapped = addr.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/) // IPv4-mapped / NAT64
  if (mapped) {
    const hi = parseInt(mapped[1], 16)
    const lo = parseInt(mapped[2], 16)
    return isPrivateIPv4([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff])
  }
  return false
}

export function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    const host = url.hostname.toLowerCase()
    // url.hostname keeps the brackets on IPv6 literals ("[fd00::1]"), so the bare-prefix
    // checks below never matched them. Judge the literal on its own terms first.
    if (host.startsWith('[') && isPrivateIPv6(host.slice(1, -1))) return false
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host === 'metadata.google.internal' ||
      host === '[::1]' || host === '::1' ||
      host.startsWith('::1')
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
