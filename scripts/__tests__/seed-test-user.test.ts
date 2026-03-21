import { describe, it, expect, vi } from 'vitest'

// Mock @prisma/client before importing the module under test
vi.mock('@prisma/client', () => {
  const PrismaClient = function () {
    return {
      user: { upsert: vi.fn() },
      $disconnect: vi.fn(),
    }
  }
  return { PrismaClient }
})

// Mock bcryptjs — we don't want real hashing in unit tests
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-test-password'),
  },
  hash: vi.fn().mockResolvedValue('hashed-test-password'),
}))

import {
  TEST_EMAIL,
  TEST_NAME,
  TEST_PASSWORD,
  buildTestUserPayload,
  buildTestUpsertArgs,
} from '../seed-test-user'

describe('seed-test-user constants', () => {
  it('exports the correct test email', () => {
    expect(TEST_EMAIL).toBe('test@test.com')
  })

  it('exports the correct test user name', () => {
    expect(TEST_NAME).toBe('Test User')
  })

  it('exports the correct test password', () => {
    expect(TEST_PASSWORD).toBe('Test1234!')
  })
})

describe('buildTestUserPayload', () => {
  it('returns an object with the test email and name', async () => {
    const payload = await buildTestUserPayload('anypassword')
    expect(payload.email).toBe(TEST_EMAIL)
    expect(payload.name).toBe(TEST_NAME)
  })

  it('includes a hashed password (not the plaintext)', async () => {
    const payload = await buildTestUserPayload('anypassword')
    expect(payload.password).toBe('hashed-test-password')
    expect(payload.password).not.toBe('anypassword')
  })

  it('includes a valid emailVerified Date', async () => {
    const before = new Date()
    const payload = await buildTestUserPayload('anypassword')
    const after = new Date()
    expect(payload.emailVerified).toBeInstanceOf(Date)
    expect(payload.emailVerified.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(payload.emailVerified.getTime()).toBeLessThanOrEqual(after.getTime())
  })

  it('does NOT set isAdmin (test users are not admins)', async () => {
    const payload = await buildTestUserPayload('anypassword')
    expect((payload as Record<string, unknown>).isAdmin).toBeUndefined()
  })

  it('shape has all required fields', async () => {
    const payload = await buildTestUserPayload('anypassword')
    expect(payload).toMatchObject({
      email: expect.any(String),
      name: expect.any(String),
      password: expect.any(String),
      emailVerified: expect.any(Date),
    })
  })
})

describe('buildTestUpsertArgs', () => {
  const mockPayload = {
    email: TEST_EMAIL,
    name: TEST_NAME,
    password: 'hashed-test-password',
    emailVerified: new Date(),
  }

  it('sets where clause to test email', () => {
    const args = buildTestUpsertArgs(mockPayload)
    expect(args.where).toEqual({ email: TEST_EMAIL })
  })

  it('sets update to an empty object (idempotent — never overwrites existing data)', () => {
    const args = buildTestUpsertArgs(mockPayload)
    expect(args.update).toEqual({})
  })

  it('passes the full payload as the create data', () => {
    const args = buildTestUpsertArgs(mockPayload)
    expect(args.create).toEqual(mockPayload)
  })

  it('update is empty — no fields would be overwritten on re-run', () => {
    const args = buildTestUpsertArgs(mockPayload)
    expect(Object.keys(args.update)).toHaveLength(0)
  })
})
