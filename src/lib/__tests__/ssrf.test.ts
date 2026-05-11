import { describe, it, expect } from 'vitest'
import { isPrivateIPv4, decodeIPv4Variants, isValidUrl } from '@/lib/ssrf'

describe('isPrivateIPv4', () => {
  it('blocks loopback 127.0.0.1', () => {
    expect(isPrivateIPv4([127, 0, 0, 1])).toBe(true)
  })

  it('blocks 0.0.0.0/8', () => {
    expect(isPrivateIPv4([0, 0, 0, 0])).toBe(true)
  })

  it('blocks RFC1918 class A — 10.x.x.x', () => {
    expect(isPrivateIPv4([10, 0, 0, 1])).toBe(true)
    expect(isPrivateIPv4([10, 255, 255, 255])).toBe(true)
  })

  it('blocks RFC1918 class B — 172.16.x.x through 172.31.x.x', () => {
    expect(isPrivateIPv4([172, 16, 0, 1])).toBe(true)
    expect(isPrivateIPv4([172, 31, 255, 255])).toBe(true)
  })

  it('does not block 172.15.x.x (just outside RFC1918 range)', () => {
    expect(isPrivateIPv4([172, 15, 0, 1])).toBe(false)
  })

  it('does not block 172.32.x.x (just outside RFC1918 range)', () => {
    expect(isPrivateIPv4([172, 32, 0, 1])).toBe(false)
  })

  it('blocks RFC1918 class C — 192.168.x.x', () => {
    expect(isPrivateIPv4([192, 168, 0, 1])).toBe(true)
    expect(isPrivateIPv4([192, 168, 255, 255])).toBe(true)
  })

  it('blocks link-local / AWS metadata — 169.254.x.x', () => {
    expect(isPrivateIPv4([169, 254, 169, 254])).toBe(true)
  })

  it('blocks multicast 224.0.0.0 and above', () => {
    expect(isPrivateIPv4([224, 0, 0, 1])).toBe(true)
    expect(isPrivateIPv4([255, 255, 255, 255])).toBe(true)
  })

  it('allows public IPs', () => {
    expect(isPrivateIPv4([8, 8, 8, 8])).toBe(false)      // Google DNS
    expect(isPrivateIPv4([1, 1, 1, 1])).toBe(false)      // Cloudflare DNS
    expect(isPrivateIPv4([104, 16, 0, 0])).toBe(false)   // Cloudflare CDN
  })

  it('returns false for malformed input (wrong length)', () => {
    expect(isPrivateIPv4([127, 0, 0])).toBe(false)
    expect(isPrivateIPv4([127, 0, 0, 1, 0])).toBe(false)
  })

  it('returns false when any part is NaN', () => {
    expect(isPrivateIPv4([NaN, 0, 0, 1])).toBe(false)
  })

  it('returns false when any part is out of 0-255 range', () => {
    expect(isPrivateIPv4([256, 0, 0, 1])).toBe(false)
    expect(isPrivateIPv4([-1, 0, 0, 1])).toBe(false)
  })
})

describe('decodeIPv4Variants', () => {
  it('parses standard dotted-decimal', () => {
    expect(decodeIPv4Variants('127.0.0.1')).toEqual([127, 0, 0, 1])
    expect(decodeIPv4Variants('10.0.0.1')).toEqual([10, 0, 0, 1])
  })

  it('parses hex-encoded octets (e.g. 0x7f.0x00.0x00.0x01)', () => {
    expect(decodeIPv4Variants('0x7f.0x00.0x00.0x01')).toEqual([127, 0, 0, 1])
  })

  it('parses octal-encoded octets (e.g. 0177.0.0.01)', () => {
    expect(decodeIPv4Variants('0177.0.0.01')).toEqual([127, 0, 0, 1])
  })

  it('expands single 32-bit integer form to 4 octets (e.g. 2130706433 = 127.0.0.1)', () => {
    // 127 * 2^24 + 0 * 2^16 + 0 * 2^8 + 1 = 2130706433
    expect(decodeIPv4Variants('2130706433')).toEqual([127, 0, 0, 1])
  })

  it('expands 32-bit integer for a public IP', () => {
    // 8.8.8.8 = 0x08080808 = 134744072
    expect(decodeIPv4Variants('134744072')).toEqual([8, 8, 8, 8])
  })

  it('returns null for a hostname (non-numeric host)', () => {
    expect(decodeIPv4Variants('example.com')).toBeNull()
  })

  it('returns null for empty-segment input', () => {
    expect(decodeIPv4Variants('127..0.1')).toBeNull()
  })

  it('returns null for a 2-segment address (not a valid IPv4 form)', () => {
    expect(decodeIPv4Variants('127.0')).toBeNull()
  })

  it('returns null for an integer too large for u32', () => {
    expect(decodeIPv4Variants('4294967296')).toBeNull() // 0xFFFFFFFF + 1
  })
})

describe('isValidUrl', () => {
  it('allows public http URLs', () => {
    expect(isValidUrl('http://example.com/recipe')).toBe(true)
    expect(isValidUrl('https://www.allrecipes.com/recipe/123')).toBe(true)
  })

  it('allows public https URLs with query strings', () => {
    expect(isValidUrl('https://example.com/recipe?id=1&foo=bar')).toBe(true)
  })

  it('blocks localhost', () => {
    expect(isValidUrl('http://localhost/api')).toBe(false)
    expect(isValidUrl('http://localhost:3000/api')).toBe(false)
  })

  it('blocks *.localhost subdomains', () => {
    expect(isValidUrl('http://api.localhost/data')).toBe(false)
  })

  it('blocks *.local mDNS domains', () => {
    expect(isValidUrl('http://mydevice.local/')).toBe(false)
  })

  it('blocks 0.0.0.0', () => {
    expect(isValidUrl('http://0.0.0.0/')).toBe(false)
  })

  it('blocks 127.0.0.1 (loopback)', () => {
    expect(isValidUrl('http://127.0.0.1/')).toBe(false)
  })

  it('blocks 10.x.x.x RFC1918', () => {
    expect(isValidUrl('http://10.0.0.1/api')).toBe(false)
  })

  it('blocks 192.168.x.x RFC1918', () => {
    expect(isValidUrl('http://192.168.1.1/admin')).toBe(false)
  })

  it('blocks 169.254.169.254 AWS metadata endpoint', () => {
    expect(isValidUrl('http://169.254.169.254/latest/meta-data/')).toBe(false)
  })

  it('blocks metadata.google.internal', () => {
    expect(isValidUrl('http://metadata.google.internal/computeMetadata/v1/')).toBe(false)
  })

  it('blocks IPv6 loopback [::1]', () => {
    expect(isValidUrl('http://[::1]/')).toBe(false)
  })

  it('blocks non-http/https schemes', () => {
    expect(isValidUrl('ftp://example.com/file')).toBe(false)
    expect(isValidUrl('file:///etc/passwd')).toBe(false)
  })

  it('blocks obviously malformed strings', () => {
    expect(isValidUrl('not a url')).toBe(false)
    expect(isValidUrl('')).toBe(false)
  })

  it('blocks 32-bit decimal encoding of loopback (2130706433 = 127.0.0.1)', () => {
    expect(isValidUrl('http://2130706433/')).toBe(false)
  })
})
