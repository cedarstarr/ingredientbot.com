import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3010'

export const UNSUBSCRIBE_TOKEN_RE = /^[a-f0-9]{64}$/

// Tokens are minted lazily on first email rather than at signup so existing users need no
// backfill migration. updateMany with `unsubscribeToken: null` makes concurrent senders race
// safely: only one write wins and every caller re-reads the winner's value.
export async function getUnsubscribeUrl(userId: string): Promise<string> {
  await prisma.user.updateMany({
    where: { id: userId, unsubscribeToken: null },
    data: { unsubscribeToken: randomBytes(32).toString('hex') },
  })
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { unsubscribeToken: true } })
  return `${SITE_URL}/unsubscribe/${user?.unsubscribeToken}`
}
