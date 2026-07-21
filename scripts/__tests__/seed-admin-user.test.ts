import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the shared Prisma client before importing the module under test
vi.mock('../_prisma', () => ({
  prisma: {
    user: { upsert: vi.fn() },
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

import {
  ADMIN_EMAIL,
  ADMIN_NAME,
  adminSeedPassword,
  buildAdminUserPayload,
  buildAdminUpsertArgs,
} from '../seed-admin-user'

describe('seed-admin-user constants', () => {
  it('exports the correct admin email', () => {
    expect(ADMIN_EMAIL).toBe('cedarbarrett@gmail.com')
  })

  it('exports the correct admin name', () => {
    expect(ADMIN_NAME).toBe('Cedar Barrett')
  })

  it('adminSeedPassword reads ADMIN_SEED_PASSWORD from env', () => {
    const prev = process.env.ADMIN_SEED_PASSWORD
    try {
      process.env.ADMIN_SEED_PASSWORD = 'env-password'
      expect(adminSeedPassword()).toBe('env-password')
    } finally {
      if (prev === undefined) delete process.env.ADMIN_SEED_PASSWORD
      else process.env.ADMIN_SEED_PASSWORD = prev
    }
  })

  it('adminSeedPassword throws when ADMIN_SEED_PASSWORD is unset', () => {
    const prev = process.env.ADMIN_SEED_PASSWORD
    try {
      delete process.env.ADMIN_SEED_PASSWORD
      expect(() => adminSeedPassword()).toThrow(/ADMIN_SEED_PASSWORD not set/)
    } finally {
      if (prev !== undefined) process.env.ADMIN_SEED_PASSWORD = prev
    }
  })
})

describe('buildAdminUserPayload', () => {
  it('returns an object with the admin email and name', async () => {
    const payload = await buildAdminUserPayload('anypassword')
    expect(payload.email).toBe(ADMIN_EMAIL)
    expect(payload.name).toBe(ADMIN_NAME)
  })

  it('sets isAdmin to true', async () => {
    const payload = await buildAdminUserPayload('anypassword')
    expect(payload.isAdmin).toBe(true)
  })

  it('includes a hashed password (not the plaintext)', async () => {
    const payload = await buildAdminUserPayload('anypassword')
    expect(payload.password).toBe('hashed-password')
    expect(payload.password).not.toBe('anypassword')
  })

  it('includes a valid emailVerified Date', async () => {
    const before = new Date()
    const payload = await buildAdminUserPayload('anypassword')
    const after = new Date()
    expect(payload.emailVerified).toBeInstanceOf(Date)
    expect(payload.emailVerified.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(payload.emailVerified.getTime()).toBeLessThanOrEqual(after.getTime())
  })

  it('shape has all required fields', async () => {
    const payload = await buildAdminUserPayload('anypassword')
    expect(payload).toMatchObject({
      email: expect.any(String),
      name: expect.any(String),
      password: expect.any(String),
      isAdmin: expect.any(Boolean),
      emailVerified: expect.any(Date),
    })
  })
})

describe('buildAdminUpsertArgs', () => {
  const mockPayload = {
    email: ADMIN_EMAIL,
    name: ADMIN_NAME,
    password: 'hashed-password',
    isAdmin: true as const,
    emailVerified: new Date(),
  }

  it('sets where clause to admin email', () => {
    const args = buildAdminUpsertArgs(mockPayload)
    expect(args.where).toEqual({ email: ADMIN_EMAIL })
  })

  it('sets update to only flip isAdmin true (no other changes)', () => {
    const args = buildAdminUpsertArgs(mockPayload)
    expect(args.update).toEqual({ isAdmin: true })
  })

  it('passes the full payload as the create data', () => {
    const args = buildAdminUpsertArgs(mockPayload)
    expect(args.create).toEqual(mockPayload)
  })

  it('does not include extra fields in update', () => {
    const args = buildAdminUpsertArgs(mockPayload)
    const updateKeys = Object.keys(args.update)
    expect(updateKeys).toHaveLength(1)
    expect(updateKeys[0]).toBe('isAdmin')
  })
})
