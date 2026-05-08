import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * Admin access control — middleware redirects.
 * test@test.com is NOT an admin in staging; /admin routes redirect to /kitchen.
 */

test.describe('Admin access control', () => {
  test.setTimeout(60000)

  test('non-admin /admin redirects to /kitchen', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/admin')
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/kitchen')
  })

  test('non-admin /admin/users redirects to /kitchen', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/admin/users')
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/kitchen')
  })

  test('unauthenticated /admin redirects to /login', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/login')
  })
})
