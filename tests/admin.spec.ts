import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

// The staging test user (test@test.com) is NOT an admin.
// Admin pages redirect non-admins to /kitchen.
// These tests verify that access control is enforced correctly.

test.describe('Admin access control — non-admin user', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test('/admin redirects non-admin to /kitchen', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('domcontentloaded')
    // requireAdmin() redirects non-admins to /kitchen
    expect(page.url()).toContain('/kitchen')
  })

  test('/admin/users redirects non-admin to /kitchen', async ({ page }) => {
    await page.goto('/admin/users')
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/kitchen')
  })

  test('/admin/audit-logs redirects non-admin to /kitchen', async ({ page }) => {
    await page.goto('/admin/audit-logs')
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/kitchen')
  })

  test('/admin/scripts redirects non-admin to /kitchen', async ({ page }) => {
    await page.goto('/admin/scripts')
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/kitchen')
  })
})

test.describe('Admin access control — unauthenticated user', () => {
  test('unauthenticated visit to /admin redirects to /login', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/login')
  })
})
