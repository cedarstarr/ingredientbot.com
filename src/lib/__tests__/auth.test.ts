import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * src/lib/auth.ts wires up the credentials `authorize()` callback that gates
 * every login — including the FOU-344 brute-force controls (per-IP rate
 * limit, progressive account lockout, and a generic failure for "wrong
 * password" / "unknown user" / "locked account" so an attacker can't
 * distinguish them). None of that runs through NextAuth's HTTP handlers in a
 * unit test, so this mocks next-auth's factory the same way
 * src/__tests__/middleware.test.ts does: capture the config object NextAuth()
 * is called with, then invoke the real `authorize()` / callback functions
 * directly against mocked Prisma/rate-limit/bcrypt.
 */

vi.mock('@/lib/env', () => ({ env: {} }))

const findUniqueMock = vi.fn()
const updateMock = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: findUniqueMock,
      update: updateMock,
    },
  },
}))

const logAuditEventMock = vi.fn()
vi.mock('@/lib/audit', () => ({ logAuditEvent: logAuditEventMock }))

const authLimiterCheckMock = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  authLimiter: { check: authLimiterCheckMock },
}))

vi.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: vi.fn(() => ({})) }))

const bcryptCompareMock = vi.fn()
vi.mock('bcryptjs', () => ({
  default: { compare: bcryptCompareMock },
  compare: bcryptCompareMock,
}))

let headersImpl: () => { get: (key: string) => string | null }
vi.mock('next/headers', () => ({
  headers: async () => headersImpl(),
}))

class MockCredentialsSignin extends Error {
  code?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let capturedConfig: any
vi.mock('next-auth', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: vi.fn((config: any) => {
    capturedConfig = config
    return { handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() }
  }),
  CredentialsSignin: MockCredentialsSignin,
}))

await import('@/lib/auth')

// @auth/core's Credentials() returns a *default* provider object
// (`authorize: () => null`) and stashes the caller's config under `.options`,
// which Auth.js merges over the defaults at request time. So the real
// authorize() lives at providers[0].options.authorize — reading
// providers[0].authorize gets the stub, which returns a bare `null`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function authorize(credentials: any): Promise<any> {
  const provider = capturedConfig.providers[0]
  const fn = provider.options?.authorize ?? provider.authorize
  return Promise.resolve(fn(credentials))
}

const baseUser = {
  id: 'u1',
  email: 'cook@example.com',
  name: 'Cook',
  image: null,
  password: 'hashed-password',
  failedLoginAttempts: 0,
  lockedUntil: null as Date | null,
}

beforeEach(() => {
  findUniqueMock.mockReset()
  updateMock.mockReset()
  logAuditEventMock.mockReset()
  authLimiterCheckMock.mockReset().mockResolvedValue({ success: true })
  bcryptCompareMock.mockReset()
  headersImpl = () => ({ get: () => '203.0.113.5' })
})

describe('authorize() — input validation', () => {
  it('returns null without checking the rate limit when email/password are missing', async () => {
    await expect(authorize({ email: '', password: '' })).resolves.toBeNull()
    expect(authLimiterCheckMock).not.toHaveBeenCalled()
  })
})

describe('authorize() — brute-force rate limit', () => {
  it('throws a RateLimit CredentialsSignin when the IP has exceeded the limit, before touching the DB', async () => {
    authLimiterCheckMock.mockResolvedValue({ success: false })
    await expect(
      authorize({ email: 'cook@example.com', password: 'x' })
    ).rejects.toMatchObject({ code: 'RateLimit' })
    expect(findUniqueMock).not.toHaveBeenCalled()
  })
})

describe('authorize() — unknown user / no password set', () => {
  it('returns null for an unknown email', async () => {
    findUniqueMock.mockResolvedValue(null)
    await expect(
      authorize({ email: 'nobody@example.com', password: 'x' })
    ).resolves.toBeNull()
  })

  it('returns null for an OAuth-only account with no password hash', async () => {
    findUniqueMock.mockResolvedValue({ ...baseUser, password: null })
    await expect(
      authorize({ email: baseUser.email, password: 'x' })
    ).resolves.toBeNull()
    expect(bcryptCompareMock).not.toHaveBeenCalled()
  })
})

describe('authorize() — locked account (FOU-344: checked before password verification)', () => {
  it('returns null without calling bcrypt when the account is currently locked', async () => {
    findUniqueMock.mockResolvedValue({
      ...baseUser,
      lockedUntil: new Date(Date.now() + 60_000),
    })
    await expect(
      authorize({ email: baseUser.email, password: 'correct-horse' })
    ).resolves.toBeNull()
    expect(bcryptCompareMock).not.toHaveBeenCalled()
  })

  it('proceeds to password verification once lockedUntil is in the past', async () => {
    findUniqueMock.mockResolvedValue({
      ...baseUser,
      lockedUntil: new Date(Date.now() - 60_000),
    })
    bcryptCompareMock.mockResolvedValue(true)
    await authorize({ email: baseUser.email, password: 'correct-horse' })
    expect(bcryptCompareMock).toHaveBeenCalled()
  })
})

describe('authorize() — wrong password', () => {
  it('increments failedLoginAttempts and returns null, without locking below the threshold', async () => {
    findUniqueMock.mockResolvedValue({ ...baseUser, failedLoginAttempts: 1 })
    updateMock.mockResolvedValue({ ...baseUser, failedLoginAttempts: 2 })
    bcryptCompareMock.mockResolvedValue(false)

    await expect(
      authorize({ email: baseUser.email, password: 'wrong' })
    ).resolves.toBeNull()

    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: baseUser.id },
      data: { failedLoginAttempts: { increment: 1 } },
    })
  })

  it('locks the account with a computed backoff once the failure count crosses the free-attempt threshold', async () => {
    // LOCKOUT_FREE_ATTEMPTS is 5 (src/lib/login-lockout.ts); the 6th failure
    // is the first attempt past it, which locks for 1 minute.
    findUniqueMock.mockResolvedValue({ ...baseUser, failedLoginAttempts: 5 })
    updateMock.mockResolvedValueOnce({ ...baseUser, failedLoginAttempts: 6 })
    bcryptCompareMock.mockResolvedValue(false)

    await expect(
      authorize({ email: baseUser.email, password: 'wrong' })
    ).resolves.toBeNull()

    expect(updateMock).toHaveBeenCalledTimes(2)
    const lockCall = updateMock.mock.calls[1][0]
    expect(lockCall.where).toEqual({ id: baseUser.id })
    expect(lockCall.data.lockedUntil).toBeInstanceOf(Date)
    const minutesUntilLock = (lockCall.data.lockedUntil.getTime() - Date.now()) / 60_000
    expect(minutesUntilLock).toBeGreaterThan(0.9)
    expect(minutesUntilLock).toBeLessThanOrEqual(1.1)
  })
})

describe('authorize() — successful login', () => {
  it('returns the minimal user shape NextAuth expects', async () => {
    findUniqueMock.mockResolvedValue({ ...baseUser })
    bcryptCompareMock.mockResolvedValue(true)

    await expect(
      authorize({ email: baseUser.email, password: 'correct-horse' })
    ).resolves.toEqual({
      id: baseUser.id,
      email: baseUser.email,
      name: baseUser.name,
      image: baseUser.image,
    })
  })

  it('clears accumulated backoff on success when there was prior failure history', async () => {
    findUniqueMock.mockResolvedValue({
      ...baseUser,
      failedLoginAttempts: 3,
      lockedUntil: new Date(Date.now() - 60_000),
    })
    bcryptCompareMock.mockResolvedValue(true)

    await authorize({ email: baseUser.email, password: 'correct-horse' })

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: baseUser.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    })
  })

  it('does not issue a reset write when there was no prior failure history', async () => {
    findUniqueMock.mockResolvedValue({ ...baseUser, failedLoginAttempts: 0, lockedUntil: null })
    bcryptCompareMock.mockResolvedValue(true)

    await authorize({ email: baseUser.email, password: 'correct-horse' })

    expect(updateMock).not.toHaveBeenCalled()
  })
})

describe('callbacks.session — invalidated token (revoked sessions)', () => {
  it('strips the user and expires the session when the token carries the invalid flag', async () => {
    const session = {
      user: { id: 'u1', isAdmin: false, emailVerified: null },
      expires: new Date(Date.now() + 86_400_000).toISOString(),
    }
    const result = await capturedConfig.callbacks.session({
      session,
      token: { invalid: true },
    })
    expect(result.user).toBeUndefined()
    expect(new Date(result.expires).getTime()).toBe(0)
  })

  it('maps id/isAdmin/emailVerified from a valid token', async () => {
    const session = {
      user: { id: 'stale', isAdmin: false, emailVerified: null },
      expires: new Date(Date.now() + 86_400_000).toISOString(),
    }
    const result = await capturedConfig.callbacks.session({
      session,
      token: { id: 'u1', isAdmin: true, emailVerified: null },
    })
    expect(result.user.id).toBe('u1')
    expect(result.user.isAdmin).toBe(true)
  })
})
