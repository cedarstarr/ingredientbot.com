import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * F29: Cooking mode — full-screen step-by-step recipe view with screen-on wake lock.
 * Route: /kitchen/cook/[id]
 */

test.describe('Cooking mode (F29)', () => {
  test.setTimeout(60000)

  test('unauthenticated access to /kitchen/cook/[id] redirects to /login', async ({ page }) => {
    const res = await page.goto('/kitchen/cook/fake-recipe-id')
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/login')
  })

  test('invalid recipe ID returns not-found, not 500', async ({ page }) => {
    await loginAsTestUser(page)
    const res = await page.goto('/kitchen/cook/clxxxxxxxxxxxxxxxxxxxxxxxxx')
    await page.waitForLoadState('domcontentloaded')
    expect(res?.status()).not.toBe(500)
    const body = await page.locator('body').textContent()
    const isNotFound = (res?.status() === 404) || /404|not found/i.test(body ?? '')
    expect(isNotFound).toBe(true)
  })

  test('"Start Cooking" link navigates to /kitchen/cook/[id] from recipe detail', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')

    const viewLinks = page.getByRole('link', { name: /view recipe/i })
    if (await viewLinks.count() === 0) {
      test.skip()
      return
    }

    await viewLinks.first().click()
    await page.waitForLoadState('domcontentloaded')

    // "Start Cooking" is a link to /kitchen/cook/[id]
    const cookLink = page.getByRole('link', { name: /start cooking/i })
    const hasCookLink = await cookLink.isVisible().catch(() => false)
    if (!hasCookLink) {
      // Button variant — check it exists in body text
      const body = await page.locator('body').textContent()
      expect(body).toMatch(/start cooking|cooking mode/i)
      return
    }

    const href = await cookLink.getAttribute('href')
    expect(href).toMatch(/\/kitchen\/cook\//)
  })

  test('cooking mode page shows step navigation for a valid recipe', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')

    const viewLinks = page.getByRole('link', { name: /view recipe/i })
    if (await viewLinks.count() === 0) {
      test.skip()
      return
    }

    await viewLinks.first().click()
    await page.waitForLoadState('domcontentloaded')

    const cookLink = page.getByRole('link', { name: /start cooking/i })
    const hasCookLink = await cookLink.isVisible().catch(() => false)
    if (!hasCookLink) {
      test.skip()
      return
    }

    await cookLink.click()
    await page.waitForLoadState('domcontentloaded')

    expect(page.url()).toMatch(/\/kitchen\/cook\//)
    // Cooking mode renders a step-by-step view
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/step|next|previous|done cooking/i)
  })
})
