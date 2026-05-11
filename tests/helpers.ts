import { type Page } from '@playwright/test'

/**
 * Log in as the staging test user via the login form UI.
 * This approach works in all environments (local, preview, production)
 * because it goes through the real login page rather than the low-level
 * NextAuth CSRF/callback API, which fails behind Vercel deployment protection.
 */
export async function loginAsTestUser(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  await page.getByLabel(/email/i).fill('test@test.com')
  await page.getByLabel(/password/i).fill('Test1234!')
  await page.getByRole('button', { name: /sign in/i }).click()

  // Wait for redirect away from /login to confirm successful auth
  await page.waitForURL(/\/(kitchen|dashboard)/, { timeout: 20_000 })
}
