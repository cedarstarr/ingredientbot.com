import { test, expect } from '@playwright/test'

/**
 * Admin sub-routes — auth gate tests — ingredientbot.com
 *
 * Routes covered:
 *   /admin/ai-debug    — AI Debug Console (admin-only)
 *   /admin/audit-logs  — Audit Logs (admin-only)
 *   /admin/scripts     — Script runner (admin-only)
 *
 * The staging test user (test@test.com) is NOT an admin.
 * Non-admin authenticated users → redirected to /kitchen.
 * Unauthenticated users → redirected to /login.
 *
 * This mirrors the pattern already used in admin.spec.ts for /admin and /admin/users.
 */

const ADMIN_SUB_ROUTES = [
  '/admin/ai-debug',
  '/admin/audit-logs',
  '/admin/scripts',
]

test.describe('Admin sub-routes — authenticated non-admin', () => {
  test.setTimeout(30000)

  for (const route of ADMIN_SUB_ROUTES) {
    test(`${route} redirects non-admin to /kitchen`, async ({ page }) => {
      await page.goto(route)
      await page.waitForLoadState('domcontentloaded')
      expect(page.url()).toContain('/kitchen')
    })
  }
})

test.describe('Admin sub-routes — unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  test.setTimeout(30000)

  for (const route of ADMIN_SUB_ROUTES) {
    test(`${route} redirects unauthenticated user to /login`, async ({ page }) => {
      await page.goto(route)
      await page.waitForLoadState('domcontentloaded')
      expect(page.url()).toContain('/login')
    })
  }
})
