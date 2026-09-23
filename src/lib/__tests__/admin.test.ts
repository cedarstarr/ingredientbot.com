import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * requireAdmin() is the server-side gate every /admin page and admin API
 * route calls before touching data — see src/lib/admin.ts. It has two
 * distinct failure modes (no session at all vs. a real but non-admin
 * session) that must land on different pages, so they're tested separately
 * rather than collapsed into one "denies access" case.
 */

const authMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: authMock }))

const redirectMock = vi.fn((path: string) => {
  // next/navigation's real redirect() throws a special NEXT_REDIRECT error to
  // unwind the render; mimic that so requireAdmin() never returns past it.
  throw new Error(`REDIRECT:${path}`)
})
vi.mock('next/navigation', () => ({ redirect: redirectMock }))

const { requireAdmin } = await import('@/lib/admin')

beforeEach(() => {
  authMock.mockReset()
  redirectMock.mockClear()
})

describe('requireAdmin', () => {
  it('redirects to /login when there is no session', async () => {
    authMock.mockResolvedValue(null)
    await expect(requireAdmin()).rejects.toThrow('REDIRECT:/login')
    expect(redirectMock).toHaveBeenCalledWith('/login')
  })

  it('redirects to /login when the session has no user', async () => {
    authMock.mockResolvedValue({ user: undefined })
    await expect(requireAdmin()).rejects.toThrow('REDIRECT:/login')
    expect(redirectMock).toHaveBeenCalledWith('/login')
  })

  it('redirects to /kitchen when the session user is not an admin', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1', isAdmin: false } })
    await expect(requireAdmin()).rejects.toThrow('REDIRECT:/kitchen')
    expect(redirectMock).toHaveBeenCalledWith('/kitchen')
  })

  it('does not treat a truthy non-boolean isAdmin as admin (strict === true check)', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1', isAdmin: 1 } })
    await expect(requireAdmin()).rejects.toThrow('REDIRECT:/kitchen')
  })

  it('returns the user and does not redirect when the session user is an admin', async () => {
    const user = { id: 'u1', isAdmin: true }
    authMock.mockResolvedValue({ user })
    await expect(requireAdmin()).resolves.toBe(user)
    expect(redirectMock).not.toHaveBeenCalled()
  })
})
