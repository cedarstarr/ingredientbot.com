/**
 * @description Seeds the production admin user (cedarbarrett@gmail.com) with isAdmin=true. Safe to run multiple times (upsert). Requires the ADMIN_SEED_PASSWORD env var (password no longer hardcoded).
 * @tables users
 */
import { prisma } from './_prisma'
import bcrypt from 'bcryptjs'


export const ADMIN_EMAIL = 'cedarbarrett@gmail.com'
export const ADMIN_NAME = 'Cedar Barrett'
// Deliberately a function (not a const) so import-time evaluation never throws —
// the env check only runs when the seed actually executes.
export function adminSeedPassword(): string {
  const seedPassword = process.env.ADMIN_SEED_PASSWORD
  if (!seedPassword) {
    throw new Error('ADMIN_SEED_PASSWORD not set — admin password rotated 2026-07-20, no longer hardcoded')
  }
  return seedPassword
}

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
    update: { name: ADMIN_NAME, password: createPayload.password, emailVerified: createPayload.emailVerified, isAdmin: true as const },
    create: createPayload,
  }
}

async function main() {
  const createPayload = await buildAdminUserPayload(adminSeedPassword())
  const user = await prisma.user.upsert(buildAdminUpsertArgs(createPayload))
  console.log('Admin user seeded:', user.email)
}

main().catch(console.error).finally(() => prisma.$disconnect())
