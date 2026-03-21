import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export const TEST_EMAIL = 'test@test.com'
export const TEST_NAME = 'Test User'
export const TEST_PASSWORD = 'Test1234!'

export async function buildTestUserPayload(password: string) {
  const hash = await bcrypt.hash(password, 12)
  return {
    email: TEST_EMAIL,
    name: TEST_NAME,
    password: hash,
    emailVerified: new Date(),
  }
}

export function buildTestUpsertArgs(createPayload: Awaited<ReturnType<typeof buildTestUserPayload>>) {
  return {
    where: { email: TEST_EMAIL },
    update: {},
    create: createPayload,
  }
}

async function main() {
  const createPayload = await buildTestUserPayload(TEST_PASSWORD)
  const user = await prisma.user.upsert(buildTestUpsertArgs(createPayload))
  console.log('Test user seeded:', user.email)
}

main().catch(console.error).finally(() => prisma.$disconnect())
