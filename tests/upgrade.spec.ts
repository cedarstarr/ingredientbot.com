import { test, expect } from '@playwright/test'

/**
 * /upgrade — Pro upgrade page (F30).
 * Verifies the page loads for authenticated users and gates anonymous visits.
 */

test.describe('Upgrade page (authenticated)', () => {
  test.setTimeout(60000)

  test('authenticated user sees pricing copy on /upgrade', async ({ page }) => {
    await page.goto('/upgrade')
    await page.waitForLoadState('domcontentloaded')

    expect(page.url()).toContain('/upgrade')
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/pro|upgrade|unlimited|pricing|free/i)
  })
})

test.describe('Upgrade page (unauthenticated)', () => {
  test.use({ storageState: undefined })
  test.setTimeout(60000)

  test('unauthenticated /upgrade redirects to /login', async ({ page }) => {
    await page.goto('/upgrade')
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/login')
  })
})
