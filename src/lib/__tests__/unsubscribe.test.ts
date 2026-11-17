import { describe, it, expect, vi, beforeEach } from 'vitest'

const updateMany = vi.fn()
const findUnique = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { user: { updateMany: (...a: unknown[]) => updateMany(...a), findUnique: (...a: unknown[]) => findUnique(...a) } } }))

import { getUnsubscribeUrl, UNSUBSCRIBE_TOKEN_RE } from '@/lib/unsubscribe'

describe('getUnsubscribeUrl', () => {
  beforeEach(() => { updateMany.mockReset(); findUnique.mockReset() })

  it('only writes a token when none exists, then links the stored one', async () => {
    findUnique.mockResolvedValue({ unsubscribeToken: 'a'.repeat(64) })
    const url = await getUnsubscribeUrl('u1')
    expect(updateMany.mock.calls[0][0].where).toEqual({ id: 'u1', unsubscribeToken: null })
    expect(updateMany.mock.calls[0][0].data.unsubscribeToken).toMatch(UNSUBSCRIBE_TOKEN_RE)
    expect(url.endsWith('/unsubscribe/' + 'a'.repeat(64))).toBe(true)
  })
})
