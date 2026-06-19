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
