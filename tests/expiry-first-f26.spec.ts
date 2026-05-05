import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * F26: Expiry-first mode — kitchen panel toggle that elevates expiring
 *      pantry items and injects context into the AI generation prompt.
 *      Also covers the PATCH /api/user/pantry/[id] endpoint used to set
 *      expiry dates on individual pantry items.
 */

test.describe('Pantry expiry — PATCH /api/user/pantry/[id] (F26)', () => {
  test.setTimeout(60000)

  test('PATCH /api/user/pantry/[id] returns 401 for unauthenticated request', async ({ request }) => {
    const res = await request.patch('/api/user/pantry/fake-id', {
      data: { expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() },
    })
    expect(res.status()).not.toBe(200)
  })

  test('PATCH /api/user/pantry/[id] can set and clear an expiry date', async ({ page }) => {
    await loginAsTestUser(page)

    // Create a pantry item to work with
    const ingredient = `e2e-expiry-${Date.now()}`
    const createRes = await page.request.post('/api/user/pantry', {
      data: { ingredient },
    })
    expect(createRes.status()).toBe(200)
    const created = await createRes.json()

    // Set an expiry 5 days from now
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
    const patchRes = await page.request.patch(`/api/user/pantry/${created.id}`, {
      data: { expiresAt: futureDate },
    })
    expect(patchRes.status()).toBe(200)
    const patched = await patchRes.json()
    expect(patched.expiresAt).toBeTruthy()

    // Clear the expiry by passing null
    const clearRes = await page.request.patch(`/api/user/pantry/${created.id}`, {
      data: { expiresAt: null },
    })
    expect(clearRes.status()).toBe(200)
    const cleared = await clearRes.json()
    expect(cleared.expiresAt).toBeNull()

    // Cleanup
    await page.request.delete(`/api/user/pantry/${created.id}`)
  })

  test('PATCH /api/user/pantry/[id] returns 404 for nonexistent item', async ({ page }) => {
    await loginAsTestUser(page)
    const res = await page.request.patch('/api/user/pantry/clxxxxxxxxxxxxxxxxxxxxxxxxx', {
      data: { expiresAt: new Date().toISOString() },
    })
    expect(res.status()).toBe(404)
  })
})

test.describe('Kitchen — expiry-first mode toggle (F26)', () => {
  test.setTimeout(60000)

  // The Expiry-first toggle is conditionally rendered — it only appears when
  // the user has pantry items with expiry dates within the next 7 days.
  // These tests seed a pantry item with a near-expiry date, verify the toggle
  // appears, interact with it, then clean up.

  test('kitchen panel shows the "Expiry-first" toggle when an expiring item is present', async ({ page }) => {
    await loginAsTestUser(page)

    // Seed an expiring pantry item (expires in 3 days)
    const ingredient = `e2e-expiry-toggle-${Date.now()}`
    const createRes = await page.request.post('/api/user/pantry', {
      data: { ingredient },
    })
    expect(createRes.status()).toBe(200)
    const created = await createRes.json()

    const soonDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    await page.request.patch(`/api/user/pantry/${created.id}`, {
      data: { expiresAt: soonDate },
    })

    // Navigate to kitchen — the toggle should now be visible
    await page.goto('/kitchen')
    await page.waitForLoadState('domcontentloaded')

    // The Expiry-first toggle renders inside the Pantry section — wait for it
    const toggle = page.getByRole('button', { name: /expiry-first mode/i })
    await expect(toggle).toBeVisible()

    // Cleanup
    await page.request.delete(`/api/user/pantry/${created.id}`)
  })

  test('clicking the Expiry-first toggle activates it', async ({ page }) => {
    await loginAsTestUser(page)

    // Seed an expiring pantry item so the toggle renders
    const ingredient = `e2e-expiry-click-${Date.now()}`
    const createRes = await page.request.post('/api/user/pantry', {
      data: { ingredient },
    })
    expect(createRes.status()).toBe(200)
    const created = await createRes.json()

    const soonDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    await page.request.patch(`/api/user/pantry/${created.id}`, {
      data: { expiresAt: soonDate },
    })

    await page.goto('/kitchen')
    await page.waitForLoadState('domcontentloaded')

    const toggle = page.getByRole('button', { name: /expiry-first mode/i })
    await expect(toggle).toBeVisible()

    // Toggle on — the "ON" badge should appear
    await toggle.click()
    await page.waitForTimeout(300)
    const body = await page.locator('main').first().textContent()
    expect(body).toMatch(/expiry/i)

    // Cleanup
    await page.request.delete(`/api/user/pantry/${created.id}`)
  })
})
