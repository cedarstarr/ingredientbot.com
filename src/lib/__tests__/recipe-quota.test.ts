import { describe, it, expect, vi, beforeEach } from 'vitest'

const updateManyMock = vi.fn()
const tx = { user: { updateMany: updateManyMock } }
vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
}))

import { withMonthlyQuota } from '../recipe-quota'

beforeEach(() => updateManyMock.mockReset())

describe('withMonthlyQuota (FOU-691)', () => {
  it('creates nothing when the conditional increment matches no row (cap reached)', async () => {
    updateManyMock.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 0 })
    const create = vi.fn()
    await expect(withMonthlyQuota('u1', create)).resolves.toBeNull()
    expect(create).not.toHaveBeenCalled()
  })

  it('increments under a recipeCount < cap guard (or isPro), then creates', async () => {
    updateManyMock.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 })
    const create = vi.fn().mockResolvedValue({ id: 'r1' })
    await expect(withMonthlyQuota('u1', create)).resolves.toEqual({ id: 'r1' })
    const where = updateManyMock.mock.calls[1][0].where
    expect(where).toEqual({ id: 'u1', OR: [{ isPro: true }, { recipeCount: { lt: 50 } }] })
  })
})
