import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the shared Prisma client before importing the module under test
vi.mock('../_prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    $disconnect: vi.fn(),
  },
}))

// Mock bcryptjs — we don't want real hashing in unit tests
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password'),
  },
  hash: vi.fn().mockResolvedValue('hashed-password'),
}))

import { prisma } from '../_prisma'
import {
  ADMIN_EMAIL,
  ADMIN_NAME,
  buildAdminUpdatePayload,
  buildAdminCreatePayload,
  run,
} from '../seed-admin-user'

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
}

describe('seed-admin-user constants', () => {
  it('exports the correct admin email', () => {
    expect(ADMIN_EMAIL).toBe('cedarbarrett@gmail.com')
  })

  it('exports the correct admin name', () => {
    expect(ADMIN_NAME).toBe('Cedar Barrett')
  })
})

describe('buildAdminUpdatePayload', () => {
  it('omits password when no hash is provided', () => {
    const payload = buildAdminUpdatePayload()
    expect(payload).toEqual({ isAdmin: true, name: ADMIN_NAME })
    expect(payload).not.toHaveProperty('password')
  })

  it('includes password only when a hash is provided', () => {
    const payload = buildAdminUpdatePayload('some-hash')
    expect(payload.password).toBe('some-hash')
  })

  it('never includes emailVerified', () => {
    const payload = buildAdminUpdatePayload('some-hash')
    expect(payload).not.toHaveProperty('emailVerified')
  })
})

describe('buildAdminCreatePayload', () => {
  it('returns an object with the admin email and name', async () => {
    const payload = await buildAdminCreatePayload('anypassword')
    expect(payload.email).toBe(ADMIN_EMAIL)
    expect(payload.name).toBe(ADMIN_NAME)
  })

  it('sets isAdmin to true', async () => {
    const payload = await buildAdminCreatePayload('anypassword')
    expect(payload.isAdmin).toBe(true)
  })

  it('includes a hashed password (not the plaintext)', async () => {
    const payload = await buildAdminCreatePayload('anypassword')
    expect(payload.password).toBe('hashed-password')
    expect(payload.password).not.toBe('anypassword')
  })

  it('includes a valid emailVerified Date', async () => {
    const before = new Date()
    const payload = await buildAdminCreatePayload('anypassword')
    const after = new Date()
    expect(payload.emailVerified).toBeInstanceOf(Date)
    expect(payload.emailVerified.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(payload.emailVerified.getTime()).toBeLessThanOrEqual(after.getTime())
  })
})

describe('run()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ADMIN_SEED_PASSWORD
  })

  afterEach(() => {
    delete process.env.ADMIN_SEED_PASSWORD
  })

  it('leaves an existing admin password untouched when ADMIN_SEED_PASSWORD is unset', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'admin-1', email: ADMIN_EMAIL })
    mockPrisma.user.update.mockResolvedValue({ id: 'admin-1', email: ADMIN_EMAIL })

    const result = await run()

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { email: ADMIN_EMAIL },
      data: { isAdmin: true, name: ADMIN_NAME },
    })
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
    expect(result).toEqual({ inserted: 0, updated: 1, deleted: 0 })
  })

  it('rotates the password when ADMIN_SEED_PASSWORD is set and the admin already exists', async () => {
    process.env.ADMIN_SEED_PASSWORD = 'a-valid-password-123'
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'admin-1', email: ADMIN_EMAIL })
    mockPrisma.user.update.mockResolvedValue({ id: 'admin-1', email: ADMIN_EMAIL })

    await run()

    const call = mockPrisma.user.update.mock.calls[0][0]
    expect(call.data.password).toBe('hashed-password')
    expect(call.data.isAdmin).toBe(true)
    expect(call.data).not.toHaveProperty('emailVerified')
  })

  it('creates a new admin with a random password when none is provided', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({ id: 'new-admin', email: ADMIN_EMAIL })

    const result = await run()

    expect(mockPrisma.user.create).toHaveBeenCalled()
    const createData = mockPrisma.user.create.mock.calls[0][0].data
    expect(createData.password).toBe('hashed-password')
    expect(createData.isAdmin).toBe(true)
    expect(result).toEqual({ inserted: 1, updated: 0, deleted: 0 })
  })

  it('throws when ADMIN_SEED_PASSWORD is provided but shorter than 12 characters', async () => {
    process.env.ADMIN_SEED_PASSWORD = 'short'

    await expect(run()).rejects.toThrow(/at least 12 characters/)
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
  })
})
