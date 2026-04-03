import { type Page } from '@playwright/test'

/**
 * Log in as the staging test user via the NextAuth CSRF/callback pattern.
 * After calling this, the browser context is authenticated and will stay
 * authenticated for the rest of the test.
 */
export async function loginAsTestUser(page: Page) {
  const csrfRes = await page.request.get('/api/auth/csrf')
  const { csrfToken } = await csrfRes.json()

  await page.request.post('/api/auth/callback/credentials', {
    form: {
      csrfToken,
      email: 'test@test.com',
      password: 'Test1234!',
      callbackUrl: 'http://localhost:3010/kitchen',
    },
  })
}
