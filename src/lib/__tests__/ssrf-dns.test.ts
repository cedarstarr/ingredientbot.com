import { describe, it, expect, vi, beforeEach } from 'vitest'

const lookup = vi.fn()
vi.mock('node:dns/promises', () => ({ lookup: (...a: unknown[]) => lookup(...a) }))

import { isPublicUrl, readTextCapped } from '@/lib/ssrf'

describe('isPublicUrl (DNS-resolving)', () => {
  beforeEach(() => lookup.mockReset())

  it('allows a hostname resolving only to public addresses', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    expect(await isPublicUrl('https://example.com/r')).toBe(true)
  })

  it.each([
    ['127.0.0.1'],
    ['169.254.169.254'],
    ['10.1.2.3'],
    ['::1'],
    ['fd00::1'],
    ['::ffff:127.0.0.1'],
  ])('blocks a public-looking name that resolves to %s', async (address) => {
    lookup.mockResolvedValue([{ address, family: address.includes(':') ? 6 : 4 }])
    expect(await isPublicUrl('http://127.0.0.1.nip.io/')).toBe(false)
  })

  it('blocks if any one of several addresses is private', async () => {
    lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '192.168.0.5', family: 4 },
    ])
    expect(await isPublicUrl('https://mixed.example/')).toBe(false)
  })

  it('fails closed when the lookup returns no addresses', async () => {
    lookup.mockResolvedValue([])
    expect(await isPublicUrl('https://nope.example/')).toBe(false)
  })

  it('does not resolve literal-blocked hosts', async () => {
    expect(await isPublicUrl('http://localhost/')).toBe(false)
    expect(lookup).not.toHaveBeenCalled()
  })
})

describe('readTextCapped', () => {
  it('stops reading at the byte cap', async () => {
    const chunk = new Uint8Array(1000).fill(97)
    let pulled = 0
    const body = new ReadableStream<Uint8Array>({
      pull(c) { pulled++; c.enqueue(chunk) },
    })
    const text = await readTextCapped(new Response(body), 2500)
    expect(text.length).toBeLessThanOrEqual(3000)
    expect(pulled).toBeLessThan(10)
  })
})
