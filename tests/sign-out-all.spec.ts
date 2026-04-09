import { test, expect } from '@playwright/test'

/**
 * Sign Out All Devices feature.
 * The endpoint POST /api/auth/signout-all revokes all active sessions.
 * We verify the endpoint exists and correctly requires authentication.
 * We do NOT call it with a valid session in E2E tests because it would
 * invalidate the test user's session mid-suite.
 */

test.describe('Sign Out All Devices — API endpoint', () => {
  test('POST /api/auth/signout-all returns 401 for unauthenticated requests', async ({ request }) => {
    const res = await request.post('/api/auth/signout-all')
    // Must require auth — returns 401 or 403
    expect(res.status()).not.toBe(200)
    expect([401, 403]).toContain(res.status())
  })
})

test.describe('Sign Out All Devices — settings page UI', () => {
  test.setTimeout(60000)

  test('"Sessions" section and "Sign Out All Devices" button render on /settings', async ({ page }) => {
    // Log in via CSRF pattern
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

    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByRole('heading', { name: /sessions/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /sign out all devices/i })).toBeVisible()
  })
})
