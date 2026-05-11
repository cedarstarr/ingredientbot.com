import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * /upgrade — Pro upgrade page (F30).
 * Verifies the page loads for authenticated users and gates anonymous visits.
 */

test.describe('Upgrade page', () => {
  test.setTimeout(60000)

  test('authenticated user sees pricing copy on /upgrade', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/upgrade')
    await page.waitForLoadState('domcontentloaded')

    expect(page.url()).toContain('/upgrade')
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/pro|upgrade|unlimited|pricing|free/i)
  })

  test('unauthenticated /upgrade redirects to /login', async ({ page }) => {
    await page.goto('/upgrade')
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/login')
  })
})
