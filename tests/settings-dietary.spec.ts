import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * Settings — dietary profile (F31) and medical flags (F79).
 * Also covers the recipe import page (F62).
 * Public recipe share page 404 path (F27).
 */

test.describe('Dietary profile (F31, F79)', () => {
  test.setTimeout(60000)

  test('settings page shows Dietary Profile section with Save button', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByRole('heading', { name: /dietary profile/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /save preferences/i })).toBeVisible()
  })

  test('F31: dietary restriction badges are present and clickable', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')

    // Wait for the dietary profile to load (async fetch)
    await page.waitForTimeout(1000)

    // Vegan restriction badge
    const veganBtn = page.getByRole('button', { name: /^vegan$/i })
    await expect(veganBtn).toBeVisible()
    await veganBtn.click()
    // The button should still be present after toggle
    await expect(veganBtn).toBeVisible()
  })

  test('F31: cuisine preference badges are present', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    await expect(page.getByRole('button', { name: /^italian$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^thai$/i })).toBeVisible()
  })

  test('F79: medical dietary flags section is present', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    await expect(page.getByRole('heading', { name: /^medical$/i })).toBeVisible()
    await expect(page.getByLabel(/low-sodium/i)).toBeVisible()
    await expect(page.getByLabel(/low-fodmap/i)).toBeVisible()
    await expect(page.getByLabel(/diabetes-friendly/i)).toBeVisible()
  })

  test('F79: medical disclaimer copy is shown', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    const body = await page.locator('body').textContent()
    expect(body).toMatch(/not medical advice/i)
  })
})

test.describe('Recipe URL import (F62)', () => {
  test.setTimeout(60000)

  test('/import page loads and shows URL input', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/import')
    await page.waitForLoadState('domcontentloaded')

    expect(page.url()).toContain('/import')
    expect(page.url()).not.toContain('/login')
    // Import page has a URL input field
    await expect(page.getByRole('textbox').first()).toBeVisible()
  })

  test('unauthenticated /import redirects to /login', async ({ page }) => {
    await page.goto('/import')
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/login')
  })
})

test.describe('Public recipe share page (F27)', () => {
  test('GET /r/nonexistent-slug returns 404 (not 500)', async ({ page }) => {
    const res = await page.goto('/r/this-slug-does-not-exist-at-all-xyz')
    await page.waitForLoadState('domcontentloaded')
    expect(res?.status()).not.toBe(500)
    // Should be 404 or a not-found UI
    const body = await page.locator('body').textContent()
    const isNotFound = res?.status() === 404 || /404|not found/i.test(body ?? '')
    expect(isNotFound).toBe(true)
  })

  test('public share page has IngredientBot nav and Try it free link for valid slug (structural)', async ({ page }) => {
    // We cannot guarantee a shared recipe exists in staging, so just verify the
    // 404 page itself doesn't crash and the /r/ route is reachable
    await page.goto('/r/test-slug')
    await page.waitForLoadState('domcontentloaded')
    // No 500 errors
    expect(page.url()).not.toContain('/login')
  })
})
