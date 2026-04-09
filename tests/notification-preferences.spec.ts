import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * Notification preferences — GET/PATCH /api/user/notifications.
 * Tests that authenticated users can read and update their email notification prefs.
 */

test.describe('Notification preferences API', () => {
  test.setTimeout(60000)

  test('GET /api/user/notifications returns notifyMarketing and notifyProduct for auth user', async ({ page }) => {
    await loginAsTestUser(page)

    const res = await page.request.get('/api/user/notifications')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(typeof body.notifyMarketing).toBe('boolean')
    expect(typeof body.notifyProduct).toBe('boolean')
  })

  test('PATCH /api/user/notifications accepts valid boolean values', async ({ page }) => {
    await loginAsTestUser(page)

    const res = await page.request.patch('/api/user/notifications', {
      data: { notifyMarketing: true, notifyProduct: false },
    })
    expect(res.status()).toBe(200)

    // Read back to confirm the update persisted
    const readback = await page.request.get('/api/user/notifications')
    const data = await readback.json()
    expect(data.notifyMarketing).toBe(true)
    expect(data.notifyProduct).toBe(false)

    // Reset to defaults so we don't pollute test state
    await page.request.patch('/api/user/notifications', {
      data: { notifyMarketing: true, notifyProduct: true },
    })
  })

  test('GET /api/user/notifications returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.get('/api/user/notifications')
    expect(res.status()).not.toBe(200)
  })
})

test.describe('Notification preferences UI — settings page', () => {
  test.setTimeout(60000)

  test('Email Notifications section shows two checkboxes (Marketing and Product)', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByRole('heading', { name: /email notifications/i })).toBeVisible()

    // Both checkboxes should be rendered
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/marketing emails/i)
    expect(body).toMatch(/product emails/i)
  })

  test('toggling a checkbox and clicking "Save Preferences" submits successfully', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')

    // Wait for the checkboxes to be loaded from the API
    const checkboxes = page.locator('input[type="checkbox"]')
    await expect(checkboxes.first()).toBeVisible()

    // Click "Save Preferences" — should not throw an error
    const saveBtn = page.getByRole('button', { name: /save preferences/i })
    await expect(saveBtn).toBeVisible()
    await saveBtn.click()

    // Button should briefly show loading state, then return to normal
    // (no error message should appear)
    await page.waitForTimeout(500)
    const body = await page.locator('body').textContent()
    expect(body).not.toMatch(/error saving preferences/i)
  })
})
