import { test, expect } from '@playwright/test'

/**
 * Public allergen reference — /allergens index + /allergens/[slug] detail.
 * No auth required (mirrors /ingredients).
 *
 * Rows are seeded UNPUBLISHED by design (highest-liability content on the
 * site — see prisma/schema.prisma Allergen model comments and
 * scripts/seed-allergens-ai.ts). This sprint does not run the seeder at all
 * (zero AI spend), so at write time there are zero rows of any kind on
 * staging. Tests therefore assert the empty/404 states as the primary path
 * and treat a populated environment as a bonus branch, rather than assuming
 * seed data the way ingredients-recipes.spec.ts can (that seeder has run).
 */

test.describe('Allergen reference', () => {
  test('/allergens renders heading and either allergen cards or the empty state @smoke', async ({ page }) => {
    const res = await page.goto('/allergens')
    await page.waitForLoadState('domcontentloaded')
    expect(res?.status()).not.toBe(500)

    await expect(page.getByRole('main').getByTestId('allergens-index-heading')).toBeVisible()

    const cards = page.getByTestId('allergens-index-card')
    const emptyState = page.getByTestId('allergens-empty-state')
    await expect(cards.first().or(emptyState)).toBeVisible()

    // The site-wide allergen disclaimer must render on every page of this
    // feature — assert it's present regardless of whether any rows exist.
    await expect(page.getByRole('main').getByTestId('allergen-disclaimer')).toBeVisible()
  })

  test('/allergens/milk renders the detail page when published, else 404s cleanly', async ({ page }) => {
    const res = await page.goto('/allergens/milk')
    await page.waitForLoadState('domcontentloaded')
    expect(res?.status()).not.toBe(500)

    const status = res?.status() ?? 0
    if (status === 404) {
      // Expected state until Cedar approves a real seeding run and publishes rows.
      const body = await page.locator('body').textContent()
      expect(/404|not found/i.test(body ?? '')).toBe(true)
      return
    }

    await expect(page.getByRole('main').getByTestId('allergen-detail-heading')).toHaveText(/milk/i)
    await expect(page.getByRole('main').getByTestId('allergen-disclaimer')).toBeVisible()

    // Three-state honesty: this page must never claim a product is "free from"
    // an allergen — it is reference content about the allergen, not a filter result.
    const mainText = (await page.getByRole('main').textContent()) ?? ''
    expect(mainText.toLowerCase()).not.toContain('free from')
  })

  test('/allergens/nonexistent-slug-that-does-not-exist returns 404 (not 500)', async ({ page }) => {
    const res = await page.goto('/allergens/nonexistent-slug-that-does-not-exist')
    await page.waitForLoadState('domcontentloaded')
    expect(res?.status()).not.toBe(500)
    const body = await page.locator('body').textContent()
    const isNotFound = res?.status() === 404 || /404|not found/i.test(body ?? '')
    expect(isNotFound).toBe(true)
  })
})
