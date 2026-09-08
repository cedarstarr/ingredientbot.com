import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'

export async function logAuditEvent(
  userId: string | null,
  action: string,
  ip: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        ip,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    })
  } catch { /* never throw from audit logger */ }
}

// AuditLog.userId is a bare string, not a relation, so the admin views cannot
// `include` the actor. Keep it that way: an audit trail has to outlive the user
// it describes (`account_delete` is precisely the row you still want once the
// User row is gone), and every other User relation here is onDelete: Cascade —
// adding one would have to opt out of that or delete the evidence. So resolve
// the emails separately: one extra query per page, not per row.
export async function resolveActorEmails(
  userIds: (string | null)[]
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => id !== null))]
  if (ids.length === 0) return new Map()

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true },
  })
  return new Map(users.map(u => [u.id, u.email]))
}

// How an actor reads in the admin tables. A miss means the User row is gone
// (see above), so fall back to the ID rather than dropping the row's identity
// entirely — a deleted account is still the answer to "who did this?".
export function actorLabel(
  userId: string | null,
  emails: Map<string, string>
): string {
  if (!userId) return '—'
  return emails.get(userId) ?? `${userId.slice(0, 12)} (deleted)`
}
