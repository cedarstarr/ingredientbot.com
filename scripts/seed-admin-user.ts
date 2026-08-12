/**
 * @description Seeds the production admin user (cedarbarrett@gmail.com) with isAdmin=true. Idempotent — re-running never resets an existing admin's password or name unless ADMIN_SEED_PASSWORD is explicitly set.
 * @tables users
 */
import { prisma } from './_prisma'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'


export const ADMIN_EMAIL = 'cedarbarrett@gmail.com'
export const ADMIN_NAME = 'Cedar Barrett'

// Existing admin: only ever flips isAdmin/name. Password is added ONLY when the caller
// explicitly supplies ADMIN_SEED_PASSWORD. Re-running this script without the env var
// must not reset a rotated admin password (see FOU-378).
export function buildAdminUpdatePayload(passwordHash?: string) {
  const update: { isAdmin: true; name: string; password?: string } = {
    isAdmin: true,
    name: ADMIN_NAME,
  }
  if (passwordHash) {
    update.password = passwordHash
  }
  return update
}

export async function buildAdminCreatePayload(password: string) {
  const hash = await bcrypt.hash(password, 12)
  return {
    email: ADMIN_EMAIL,
    name: ADMIN_NAME,
    password: hash,
    isAdmin: true as const,
    emailVerified: new Date(),
  }
}

export async function run(): Promise<{ inserted: number; updated: number; deleted: number }> {
  const envPassword = process.env.ADMIN_SEED_PASSWORD
  if (envPassword && envPassword.length < 12) {
    throw new Error('ADMIN_SEED_PASSWORD must be at least 12 characters')
  }

  let inserted = 0
  let updated = 0

  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (existing) {
    const passwordHash = envPassword ? await bcrypt.hash(envPassword, 12) : undefined
    const user = await prisma.user.update({
      where: { email: ADMIN_EMAIL },
      data: buildAdminUpdatePayload(passwordHash),
    })
    updated++
    console.log('Admin user updated:', user.email)
  } else {
    const seedPassword = envPassword ?? randomBytes(24).toString('base64url')
    const createPayload = await buildAdminCreatePayload(seedPassword)
    const user = await prisma.user.create({ data: createPayload })
    inserted++
    if (!envPassword) {
      // Only chance to capture this — never logged again.
      console.log(`Admin created with random password: ${seedPassword}`)
      console.log('Use /forgot-password to set a permanent password.')
    }
    console.log('Admin user seeded:', user.email)
  }

  return { inserted, updated, deleted: 0 }
}

if (require.main === module) {
  run().catch(console.error).finally(() => prisma.$disconnect())
}
