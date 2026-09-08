import { describe, it, expect, vi } from 'vitest'

// audit.ts pulls in the Prisma client at module scope; the label helper under
// test is pure, so stub the client rather than standing up a database.
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/generated/prisma/client', () => ({ Prisma: {} }))

const { actorLabel } = await import('../audit')

describe('audit actor labels', () => {
  const emails = new Map([['cmob4zpl90000abcdefghijkl', 'cook@example.com']])

  it('names the actor when the user still exists', () => {
    expect(actorLabel('cmob4zpl90000abcdefghijkl', emails)).toBe('cook@example.com')
  })

  it('keeps the ID visible for a deleted account', () => {
    // account_delete rows outlive their user by design, and "—" would erase the
    // only identity the row has left.
    expect(actorLabel('cmgone12345678zzzzzzzzzzz', emails)).toBe('cmgone123456 (deleted)')
  })

  it('renders a dash only when the event had no actor', () => {
    expect(actorLabel(null, emails)).toBe('—')
  })
})
