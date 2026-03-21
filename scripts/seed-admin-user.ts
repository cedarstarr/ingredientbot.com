import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export const ADMIN_EMAIL = 'cedarbarrett@gmail.com'
export const ADMIN_NAME = 'Cedar Barrett'
export const ADMIN_PASSWORD = 'CedarAdmin2026!'

export async function buildAdminUserPayload(password: string) {
  const hash = await bcrypt.hash(password, 12)
  return {
    email: ADMIN_EMAIL,
    name: ADMIN_NAME,
    password: hash,
    isAdmin: true as const,
    emailVerified: new Date(),
  }
}

export function buildAdminUpsertArgs(createPayload: Awaited<ReturnType<typeof buildAdminUserPayload>>) {
  return {
    where: { email: ADMIN_EMAIL },
    update: { isAdmin: true as const },
    create: createPayload,
  }
}

async function main() {
  const createPayload = await buildAdminUserPayload(ADMIN_PASSWORD)
  const user = await prisma.user.upsert(buildAdminUpsertArgs(createPayload))
  console.log('Admin user seeded:', user.email)
}

main().catch(console.error).finally(() => prisma.$disconnect())
